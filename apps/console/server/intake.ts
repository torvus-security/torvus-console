import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { createSupabaseServiceRoleClient } from '../lib/supabase';
import { logAudit, type RequestLike } from './audit';
import { sendEvent } from './notify';
import { INVESTIGATION_SEVERITIES, type InvestigationSeverity } from '../lib/investigations/constants';
import { getStaffUserByEmail } from '../lib/auth';

export type IntakeIntegrationKind = 'generic' | 'statuspage' | 'sentry' | 'posthog';

export type IntakeIntegrationRow = {
  id: string;
  kind: IntakeIntegrationKind;
  name: string;
  secret_hash: string;
  secret_ciphertext?: string | null;
  enabled: boolean;
  created_at: string | null;
  last_seen_at: string | null;
};

export type IntakeIntegrationSecretRow = IntakeIntegrationRow & { secret_ciphertext: string };

export type IntakeEventRow = {
  id: string;
  integration_id: string;
  ext_id: string;
  dedup_hash: string;
  received_at: string | null;
  payload: Record<string, unknown>;
};

type VerifyHeaders = Headers | Record<string, string | string[]> | { get(name: string): string | null };

type RouteResult = { action: 'created' | 'appended'; id: string | null };

type AutomationActor = { userId: string; email: string | null };

type InvestigationSummary = {
  vendorId: string | null;
  title: string;
  severity: InvestigationSeverity;
  note: string;
  link: string | null;
  tags: string[];
};

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_IV_LENGTH = 12;
const ENCRYPTION_TAG_LENGTH = 16;

let cachedEncryptionKey: Buffer | null = null;

function formatBytea(buffer: Buffer): string {
  return `\\x${buffer.toString('hex')}`;
}

function normaliseEncryptionKey(raw: string): Buffer {
  const trimmed = raw.trim();
  if (!trimmed) {
    return Buffer.alloc(0);
  }

  if (trimmed.startsWith('base64:')) {
    return Buffer.from(trimmed.slice(7), 'base64');
  }

  if (trimmed.startsWith('hex:')) {
    return Buffer.from(trimmed.slice(4), 'hex');
  }

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }

  if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length >= 44) {
    try {
      return Buffer.from(trimmed, 'base64');
    } catch {
      // fall through to utf8 fallback
    }
  }

  return Buffer.from(trimmed, 'utf8');
}

function resolveEncryptionKey(): Buffer {
  if (cachedEncryptionKey) {
    return cachedEncryptionKey;
  }

  let raw = process.env.TORVUS_INTAKE_SECRET_KEY ?? process.env.TORVUS_SECRET_ENCRYPTION_KEY;
  if (!raw || !raw.trim()) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[intake] TORVUS_INTAKE_SECRET_KEY not set; using development fallback key');
      raw = 'torvus-intake-secret-key-32-byte';
    } else {
      throw new Error('[intake] TORVUS_INTAKE_SECRET_KEY is not configured');
    }
  }

  const key = normaliseEncryptionKey(raw);
  if (key.length !== 32) {
    throw new Error(`[intake] TORVUS_INTAKE_SECRET_KEY must be 32 bytes, received ${key.length}`);
  }

  cachedEncryptionKey = key;
  return key;
}

function encryptSecret(secret: string): string {
  const key = resolveEncryptionKey();
  const iv = randomBytes(ENCRYPTION_IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, authTag, ciphertext]);
  return formatBytea(payload);
}

function decryptSecretPayload(ciphertextHex: string): string {
  const payload = toHexBuffer(ciphertextHex);
  if (payload.length <= ENCRYPTION_IV_LENGTH + ENCRYPTION_TAG_LENGTH) {
    throw new Error('invalid intake secret payload');
  }

  const key = resolveEncryptionKey();
  const iv = payload.subarray(0, ENCRYPTION_IV_LENGTH);
  const authTag = payload.subarray(ENCRYPTION_IV_LENGTH, ENCRYPTION_IV_LENGTH + ENCRYPTION_TAG_LENGTH);
  const ciphertext = payload.subarray(ENCRYPTION_IV_LENGTH + ENCRYPTION_TAG_LENGTH);

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

export function decryptIntegrationSecret(row: { secret_ciphertext?: string | null }): string {
  const payload = row.secret_ciphertext;
  if (!payload) {
    throw new Error('missing integration secret payload');
  }
  return decryptSecretPayload(payload);
}

function toHexBuffer(value: string): Buffer {
  const trimmed = value.trim().toLowerCase();
  const hex = trimmed.startsWith('0x') || trimmed.startsWith('\\x') ? trimmed.slice(2) : trimmed;
  return Buffer.from(hex, 'hex');
}

function normaliseHeaders(input: VerifyHeaders): Headers {
  if (input instanceof Headers) {
    return input;
  }

  const headers = new Headers();

  if (typeof (input as any).entries === 'function') {
    for (const [key, value] of (input as any).entries() as Iterable<[string, string]>) {
      headers.append(key, value);
    }
    return headers;
  }

  const entries = input as Record<string, string | string[]>;
  for (const [key, value] of Object.entries(entries)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        headers.append(key, entry);
      }
    } else if (typeof value === 'string') {
      headers.set(key, value);
    }
  }
  return headers;
}

function getHeaderCaseInsensitive(headers: Headers, name: string): string | null {
  const direct = headers.get(name);
  if (direct) {
    return direct;
  }
  const lower = name.toLowerCase();
  for (const [key, value] of headers.entries()) {
    if (key.toLowerCase() === lower) {
      return value;
    }
  }
  return null;
}

function constantTimeEquals(expectedHex: string, providedHex: string): boolean {
  const normalise = (value: string) => {
    const trimmed = value.trim();
    const withoutPrefix = trimmed.startsWith('sha256=') ? trimmed.slice(7) : trimmed;
    return withoutPrefix.toLowerCase();
  };

  const expected = normalise(expectedHex);
  const provided = normalise(providedHex);
  if (!/^[0-9a-f]+$/.test(expected) || !/^[0-9a-f]+$/.test(provided)) {
    return false;
  }
  const expectedBuf = Buffer.from(expected, 'hex');
  const providedBuf = Buffer.from(provided, 'hex');
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return timingSafeEqual(expectedBuf, providedBuf);
}

function pickString(payload: Record<string, any>, keys: string[]): string | null {
  for (const key of keys) {
    const segments = key.split('.');
    let current: any = payload;
    let valid = true;
    for (const segment of segments) {
      if (current && typeof current === 'object' && segment in current) {
        current = current[segment];
      } else {
        valid = false;
        break;
      }
    }

    if (!valid) {
      continue;
    }

    if (typeof current === 'string' && current.trim()) {
      return current.trim();
    }
  }
  return null;
}

export function extractVendorId(kind: IntakeIntegrationKind, payload: Record<string, unknown>): string | null {
  const record = payload as Record<string, any>;
  const candidates = [
    pickString(record, ['incident.id']),
    pickString(record, ['issue.id']),
    pickString(record, ['event.id']),
    pickString(record, ['event.event_id']),
    pickString(record, ['data.id']),
    pickString(record, ['alert_id']),
    pickString(record, ['uuid']),
    pickString(record, ['id'])
  ];

  const value = candidates.find((candidate) => candidate && candidate.length >= 5) ?? null;

  if (value) {
    return value;
  }

  if (kind === 'posthog') {
    const fallback = pickString(record, ['event.distinct_id', 'event.properties.distinct_id']);
    if (fallback) {
      return fallback;
    }
  }

  return null;
}

function computeHmac(secret: Buffer, payload: string, seed?: string): string {
  const hmac = createHmac('sha256', secret);
  if (seed) {
    hmac.update(seed);
  }
  hmac.update(payload);
  return hmac.digest('hex');
}

function resolveSecret(secret: string | Buffer): Buffer {
  if (Buffer.isBuffer(secret)) {
    return secret;
  }
  const trimmed = secret.trim();
  if (!trimmed) {
    return Buffer.alloc(0);
  }
  if (/^\\x[0-9a-f]+$/i.test(trimmed) || /^0x[0-9a-f]+$/i.test(trimmed)) {
    return toHexBuffer(trimmed);
  }
  if (/^[0-9a-f]+$/i.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }
  return Buffer.from(trimmed, 'utf8');
}

function parseSignature(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith('sha256=')) {
    return trimmed.slice(7);
  }
  return trimmed;
}

function verifyGeneric(headers: Headers, rawBody: string, secret: Buffer, headerName: string): boolean {
  const headerValue = getHeaderCaseInsensitive(headers, headerName);
  if (!headerValue) {
    return false;
  }
  const parsed = parseSignature(headerValue);
  if (!parsed) {
    return false;
  }
  const expected = computeHmac(secret, rawBody);
  return constantTimeEquals(expected, parsed);
}

function verifySentry(headers: Headers, rawBody: string, secret: Buffer): boolean {
  const signatureHeader = getHeaderCaseInsensitive(headers, 'sentry-hook-signature');
  const timestamp = getHeaderCaseInsensitive(headers, 'sentry-hook-timestamp');

  if (!signatureHeader) {
    return false;
  }

  let ts = timestamp?.trim() ?? null;
  let provided: string | null = null;

  const parts = signatureHeader.split(',');
  for (const part of parts) {
    const [key, value] = part.split('=', 2).map((segment) => segment.trim());
    if (!key || !value) {
      continue;
    }
    if (key === 't') {
      ts = value;
    } else if (key === 'v1' || key === 'v0') {
      provided = value;
    }
  }

  if (!ts || !provided) {
    return false;
  }

  const expected = computeHmac(secret, rawBody, `${ts}.`);
  return constantTimeEquals(expected, provided);
}

export function verifySignature(
  kind: IntakeIntegrationKind,
  rawBody: string,
  headersInput: VerifyHeaders,
  secret: string | Buffer
): boolean {
  const secretKey = resolveSecret(secret);
  const headers = normaliseHeaders(headersInput);

  if (secretKey.length === 0) {
    return false;
  }

  switch (kind) {
    case 'generic':
      return verifyGeneric(headers, rawBody, secretKey, 'x-torvus-signature');
    case 'statuspage':
      return (
        verifyGeneric(headers, rawBody, secretKey, 'x-statuspage-signature')
        || verifyGeneric(headers, rawBody, secretKey, 'x-torvus-signature')
      );
    case 'posthog':
      return (
        verifyGeneric(headers, rawBody, secretKey, 'x-posthog-signature')
        || verifyGeneric(headers, rawBody, secretKey, 'x-hub-signature-256')
        || verifyGeneric(headers, rawBody, secretKey, 'x-torvus-signature')
      );
    case 'sentry':
      return verifySentry(headers, rawBody, secretKey) || verifyGeneric(headers, rawBody, secretKey, 'sentry-signature');
    default:
      return false;
  }
}

function hashSecret(secret: string): string {
  const digest = createHash('sha256').update(secret, 'utf8').digest();
  return formatBytea(digest);
}

export async function upsertIntegration(
  kind: IntakeIntegrationKind,
  name: string,
  secretPlain: string,
  requestLike?: RequestLike
): Promise<IntakeIntegrationRow> {
  const supabase = createSupabaseServiceRoleClient<any>();
  const normalisedName = name.trim();
  const payload = {
    kind,
    name: normalisedName,
    secret_hash: hashSecret(secretPlain),
    secret_ciphertext: encryptSecret(secretPlain),
    enabled: true
  };

  const { data, error } = await (supabase.from('inbound_integrations') as any)
    .upsert(payload, { onConflict: 'kind,name' })
    .select('id, kind, name, secret_hash, enabled, created_at, last_seen_at')
    .single();

  if (error) {
    console.error('[intake] failed to upsert integration', error);
    throw error;
  }

  const row = data as IntakeIntegrationRow;
  await logAudit(
    {
      action: 'intake.integration_created',
      targetType: 'inbound_integration',
      targetId: row.id,
      resource: 'console.integrations',
      meta: {
        kind: row.kind,
        name: row.name
      }
    },
    requestLike
  );

  return row;
}

async function loadIntegrationByName(
  kind: IntakeIntegrationKind,
  name: string
): Promise<IntakeIntegrationRow | null> {
  const supabase = createSupabaseServiceRoleClient<any>();
  const { data, error } = await (supabase.from('inbound_integrations') as any)
    .select('id, kind, name, secret_hash, secret_ciphertext, enabled, created_at, last_seen_at')
    .eq('kind', kind)
    .eq('name', name.trim())
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('[intake] failed to load integration by name', error);
    throw error;
  }

  return (data as IntakeIntegrationSecretRow | null) ?? null;
}

async function findEventByExt(
  integrationId: string,
  extId: string
): Promise<IntakeEventRow | null> {
  const supabase = createSupabaseServiceRoleClient<any>();
  const { data, error } = await (supabase.from('inbound_events') as any)
    .select('id, integration_id, ext_id, dedup_hash, received_at, payload')
    .eq('integration_id', integrationId)
    .eq('ext_id', extId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return (data as IntakeEventRow | null) ?? null;
}

async function findEventByHash(
  integrationId: string,
  dedupHash: string
): Promise<IntakeEventRow | null> {
  const supabase = createSupabaseServiceRoleClient<any>();
  const { data, error } = await (supabase.from('inbound_events') as any)
    .select('id, integration_id, ext_id, dedup_hash, received_at, payload')
    .eq('integration_id', integrationId)
    .eq('dedup_hash', dedupHash)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return (data as IntakeEventRow | null) ?? null;
}

function computeDedupHash(rawBody: string): string {
  const digest = createHash('sha256').update(rawBody, 'utf8').digest();
  return formatBytea(digest);
}

export async function recordInbound(
  integrationId: string,
  extId: string,
  rawBody: string,
  payload: Record<string, unknown>
): Promise<{ duplicate: boolean; event: IntakeEventRow | null }> {
  const supabase = createSupabaseServiceRoleClient<any>();
  const dedupHash = computeDedupHash(rawBody);

  if (extId) {
    const existing = await findEventByExt(integrationId, extId);
    if (existing) {
      await (supabase.from('inbound_integrations') as any)
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', integrationId);
      return { duplicate: true, event: existing };
    }
  }

  const existingByHash = await findEventByHash(integrationId, dedupHash);
  if (existingByHash) {
    await (supabase.from('inbound_integrations') as any)
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', integrationId);
    return { duplicate: true, event: existingByHash };
  }

  const insertPayload = {
    integration_id: integrationId,
    ext_id: extId,
    dedup_hash: dedupHash,
    payload
  };

  const { data, error } = await (supabase.from('inbound_events') as any)
    .insert(insertPayload)
    .select('id, integration_id, ext_id, dedup_hash, received_at, payload')
    .single();

  if (error) {
    console.error('[intake] failed to insert inbound event', error);
    throw error;
  }

  const eventRow = data as IntakeEventRow;

  await (supabase.from('inbound_integrations') as any)
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', integrationId);

  await logAudit({
    action: 'intake.event_received',
    targetType: 'inbound_integration',
    targetId: integrationId,
    resource: 'console.integrations',
    meta: {
      event_id: eventRow.id,
      ext_id: eventRow.ext_id
    }
  });

  return { duplicate: false, event: eventRow };
}

function normaliseSeverity(value: unknown): InvestigationSeverity {
  if (!value) {
    return 'medium';
  }

  if (typeof value === 'number') {
    if (value >= 4) {
      return 'critical';
    }
    if (value === 3) {
      return 'high';
    }
    if (value === 2) {
      return 'medium';
    }
    return 'low';
  }

  if (typeof value !== 'string') {
    return 'medium';
  }

  const normalised = value.trim().toLowerCase();
  if (!normalised) {
    return 'medium';
  }

  if (['critical', 'catastrophic', 'fatal', 'severe'].includes(normalised)) {
    return 'critical';
  }
  if (['high', 'major', 'error', 'p1', 'urgent'].includes(normalised)) {
    return 'high';
  }
  if (['medium', 'moderate', 'warning', 'minor', 'p2'].includes(normalised)) {
    return 'medium';
  }
  if (['low', 'info', 'informational', 'p3', 'p4', 'none'].includes(normalised)) {
    return 'low';
  }

  if (INVESTIGATION_SEVERITIES.includes(normalised as InvestigationSeverity)) {
    return normalised as InvestigationSeverity;
  }

  return 'medium';
}

function deriveSummary(kind: IntakeIntegrationKind, payload: Record<string, any>): InvestigationSummary {
  let vendorId: string | null = null;
  let title = 'Automated intake event';
  let link: string | null = null;
  let severity: InvestigationSeverity = 'medium';
  let note = 'Inbound event captured.';
  const tags = new Set<string>(['source:intake', `source:${kind}`]);

  vendorId = extractVendorId(kind, payload);

  const urlCandidate = pickString(payload, [
    'incident.shortlink',
    'incident.url',
    'web_url',
    'url',
    'permalink',
    'html_url'
  ]);
  if (urlCandidate) {
    link = urlCandidate;
  }

  const messageCandidate =
    pickString(payload, ['incident.name', 'issue.title', 'event.title', 'message', 'title', 'description', 'summary'])
    ?? 'New inbound alert';

  title = `${kind}: ${messageCandidate}`.slice(0, 200);

  const severityCandidate =
    pickString(payload, [
      'incident.impact',
      'incident.severity',
      'severity',
      'issue.level',
      'event.level',
      'level',
      'alert.severity'
    ]);
  severity = normaliseSeverity(severityCandidate);

  const statusCandidate = pickString(payload, ['incident.status', 'issue.status']);

  const noteLines = [messageCandidate];
  if (statusCandidate) {
    noteLines.push(`Status: ${statusCandidate}`);
  }
  if (link) {
    noteLines.push(`Link: ${link}`);
  }
  note = noteLines.join('\n');

  if (vendorId) {
    tags.add(`vendor:${vendorId}`);
    tags.add(`${kind}:${vendorId}`);
  }

  return { vendorId, title, severity, note, link, tags: Array.from(tags) };
}

async function resolveAutomationActor(): Promise<AutomationActor | null> {
  const supabase = createSupabaseServiceRoleClient<any>();

  const envId = process.env.TORVUS_INTAKE_ACTOR_ID?.trim();
  if (envId) {
    const { data, error } = await (supabase.from('staff_users') as any)
      .select('user_id, email')
      .eq('user_id', envId)
      .maybeSingle();
    if (!error && data?.user_id) {
      return { userId: data.user_id, email: data.email ?? null };
    }
  }

  const envEmail = process.env.TORVUS_INTAKE_ACTOR_EMAIL?.trim();
  if (envEmail) {
    try {
      const staff = await getStaffUserByEmail(envEmail, supabase);
      if (staff) {
        return { userId: staff.user_id, email: staff.email };
      }
    } catch (error) {
      console.warn('[intake] failed to resolve intake actor email', error);
    }
  }

  try {
    const { data, error } = await (supabase.from('staff_users') as any)
      .select('user_id, email, staff_role_members!inner(staff_roles!inner(name))')
      .eq('staff_role_members.staff_roles.name', 'security_admin')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!error && data?.user_id) {
      return { userId: data.user_id, email: data.email ?? null };
    }
  } catch (error) {
    console.warn('[intake] failed to load security admin actor', error);
  }

  try {
    const { data, error } = await (supabase.from('staff_users') as any)
      .select('user_id, email')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!error && data?.user_id) {
      return { userId: data.user_id, email: data.email ?? null };
    }
  } catch (error) {
    console.warn('[intake] failed to load fallback actor', error);
  }

  return null;
}

async function findExistingInvestigation(tag: string): Promise<string | null> {
  const supabase = createSupabaseServiceRoleClient<any>();
  try {
    const { data, error } = await (supabase.from('investigations') as any)
      .select('id, status')
      .contains('tags', [tag])
      .in('status', ['open', 'triage', 'in_progress'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('[intake] failed to lookup existing investigation', error);
      return null;
    }

    return data?.id ?? null;
  } catch (error) {
    console.error('[intake] unexpected error looking up investigation', error);
    return null;
  }
}

async function appendInvestigationNote(
  investigationId: string,
  actor: AutomationActor,
  summary: InvestigationSummary,
  kind: IntakeIntegrationKind,
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = createSupabaseServiceRoleClient<any>();

  const { error } = await (supabase.from('investigation_events') as any)
    .insert({
      investigation_id: investigationId,
      actor_user_id: actor.userId,
      kind: 'note',
      message: summary.note,
      meta: {
        source: 'intake',
        kind,
        vendor_id: summary.vendorId,
        link: summary.link,
        payload
      }
    });

  if (error) {
    console.error('[intake] failed to append investigation note', error);
  }
}

async function createInvestigation(
  actor: AutomationActor,
  summary: InvestigationSummary,
  kind: IntakeIntegrationKind,
  payload: Record<string, unknown>
): Promise<string | null> {
  const supabase = createSupabaseServiceRoleClient<any>();

  const { data, error } = await (supabase.from('investigations') as any)
    .insert({
      title: summary.title,
      severity: summary.severity,
      summary: summary.note,
      tags: summary.tags,
      opened_by: actor.userId
    })
    .select('id')
    .single();

  if (error) {
    console.error('[intake] failed to create investigation', error);
    return null;
  }

  const investigationId = data?.id ?? null;
  if (!investigationId) {
    return null;
  }

  await appendInvestigationNote(investigationId, actor, summary, kind, payload);

  await logAudit({
    action: 'intake.investigation_created_from_intake',
    targetType: 'investigation',
    targetId: investigationId,
    resource: 'console.investigations',
    meta: {
      source: 'intake',
      vendor_id: summary.vendorId,
      tags: summary.tags
    }
  });

  try {
    await sendEvent('investigation.created', {
      id: investigationId,
      title: summary.title,
      severity: summary.severity,
      source: 'intake',
      vendor_id: summary.vendorId ?? undefined
    });
  } catch (error) {
    console.warn('[intake] failed to dispatch investigation.created notification', error);
  }

  return investigationId;
}

export async function routeToInvestigation(
  kind: IntakeIntegrationKind,
  payload: Record<string, unknown>
): Promise<RouteResult> {
  const summary = deriveSummary(kind, payload as Record<string, any>);
  const actor = await resolveAutomationActor();

  if (!actor) {
    console.error('[intake] unable to resolve automation actor; skipping intake routing');
    return { action: 'appended', id: null };
  }

  if (summary.vendorId) {
    const vendorTag = `${kind}:${summary.vendorId}`;
    const existingId = await findExistingInvestigation(vendorTag);
    if (existingId) {
      await appendInvestigationNote(existingId, actor, summary, kind, payload);
      return { action: 'appended', id: existingId };
    }
  }

  const createdId = await createInvestigation(actor, summary, kind, payload);
  return createdId ? { action: 'created', id: createdId } : { action: 'appended', id: null };
}

export async function getIntegration(
  kind: IntakeIntegrationKind,
  name: string
): Promise<IntakeIntegrationSecretRow | null> {
  return loadIntegrationByName(kind, name);
}

export async function listIntegrations(): Promise<IntakeIntegrationRow[]> {
  const supabase = createSupabaseServiceRoleClient<any>();
  const { data, error } = await (supabase.from('inbound_integrations') as any)
    .select('id, kind, name, secret_hash, enabled, created_at, last_seen_at')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[intake] failed to list inbound integrations', error);
    return [];
  }

  return ((data as IntakeIntegrationRow[] | null) ?? []).map((row) => ({
    ...row,
    secret_hash: row.secret_hash
  }));
}

export async function countEventsByIntegration(): Promise<Record<string, number>> {
  const supabase = createSupabaseServiceRoleClient<any>();
  const { data, error } = await (supabase.from('inbound_events') as any)
    .select('integration_id, count:count()', { head: false })
    .group('integration_id');

  if (error) {
    console.error('[intake] failed to count inbound events', error);
    return {};
  }

  const counts: Record<string, number> = {};
  const rows = data as Array<{ integration_id: string; count: number }> | null;
  if (rows) {
    for (const row of rows) {
      counts[row.integration_id] = Number(row.count) || 0;
    }
  }
  return counts;
}

export async function rotateIntegrationSecret(
  id: string,
  secretPlain: string,
  requestLike?: RequestLike
): Promise<IntakeIntegrationRow | null> {
  const supabase = createSupabaseServiceRoleClient<any>();
  const secretHash = hashSecret(secretPlain);
  const secretCiphertext = encryptSecret(secretPlain);

  const { data, error } = await (supabase.from('inbound_integrations') as any)
    .update({ secret_hash: secretHash, secret_ciphertext: secretCiphertext })
    .eq('id', id)
    .select('id, kind, name, secret_hash, enabled, created_at, last_seen_at')
    .maybeSingle();

  if (error) {
    console.error('[intake] failed to rotate integration secret', error);
    throw error;
  }

  if (!data) {
    return null;
  }

  await logAudit(
    {
      action: 'intake.integration_created',
      targetType: 'inbound_integration',
      targetId: id,
      resource: 'console.integrations',
      meta: { rotated: true }
    },
    requestLike
  );

  return data as IntakeIntegrationRow;
}

export async function setIntegrationEnabled(id: string, enabled: boolean): Promise<IntakeIntegrationRow | null> {
  const supabase = createSupabaseServiceRoleClient<any>();
  const { data, error } = await (supabase.from('inbound_integrations') as any)
    .update({ enabled })
    .eq('id', id)
    .select('id, kind, name, secret_hash, enabled, created_at, last_seen_at')
    .maybeSingle();

  if (error) {
    console.error('[intake] failed to toggle integration', error);
    throw error;
  }

  return (data as IntakeIntegrationRow | null) ?? null;
}

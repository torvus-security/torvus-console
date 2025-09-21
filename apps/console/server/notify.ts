import { createSupabaseServiceRoleClient } from '../lib/supabase';

type WebhookKind = 'slack' | 'teams';

type WebhookRow = {
  id: string;
  kind: WebhookKind;
  url: string;
  enabled: boolean;
};

type NotificationPrefRow = {
  event: string;
  enabled: boolean;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatPayload(payload: Record<string, unknown>): string {
  try {
    return JSON.stringify(payload, null, 2);
  } catch (error) {
    console.warn('[notify] failed to serialise payload', error);
    return JSON.stringify({ notice: 'payload_serialisation_failed' });
  }
}

async function dispatchWebhook(
  webhook: WebhookRow,
  event: string,
  prettyPayload: string
): Promise<boolean> {
  const body =
    webhook.kind === 'slack'
      ? {
          text: `*Torvus* — ${event}\n\`\`\`json\n${prettyPayload}\n\`\`\``
        }
      : {
          text: `Torvus — ${event}\n<pre>${escapeHtml(prettyPayload)}</pre>`
        };

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      console.warn(
        `[notify] ${webhook.kind} webhook ${webhook.id} responded with ${response.status}`
      );
      return false;
    }

    return true;
  } catch (error) {
    console.warn(`[notify] failed to dispatch ${webhook.kind} webhook ${webhook.id}`, error);
    return false;
  }
}

async function loadNotificationPref(event: string): Promise<NotificationPrefRow | null> {
  const supabase = createSupabaseServiceRoleClient<any>();

  try {
    const { data, error } = await (supabase.from('notification_prefs') as any)
      .select('event, enabled')
      .eq('event', event)
      .maybeSingle();

    if (error) {
      console.warn('[notify] failed to load notification preference', { event, error });
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      event: data.event,
      enabled: Boolean(data.enabled)
    };
  } catch (error) {
    console.warn('[notify] error loading notification preference', { event, error });
    return null;
  }
}

async function loadEnabledWebhooks(): Promise<WebhookRow[]> {
  const supabase = createSupabaseServiceRoleClient<any>();

  try {
    const { data, error } = await (supabase.from('outbound_webhooks') as any)
      .select('id, kind, url, enabled')
      .eq('enabled', true);

    if (error) {
      console.warn('[notify] failed to load outbound webhooks', error);
      return [];
    }

    const rows = (data as Array<{ id: string; kind: WebhookKind; url: string; enabled: boolean }> | null) ?? [];
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      url: row.url,
      enabled: Boolean(row.enabled)
    }));
  } catch (error) {
    console.warn('[notify] error loading webhooks', error);
    return [];
  }
}

export async function sendEvent(event: string, payload: Record<string, unknown>): Promise<void> {
  const pref = await loadNotificationPref(event);

  if (!pref || !pref.enabled) {
    return;
  }

  const webhooks = await loadEnabledWebhooks();
  if (!webhooks.length) {
    return;
  }

  const pretty = formatPayload(payload);
  await Promise.all(webhooks.map((webhook) => dispatchWebhook(webhook, event, pretty)));
}

export async function sendWebhookPreview(
  webhook: { id: string; kind: WebhookKind; url: string },
  event: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const pretty = formatPayload(payload);
  return dispatchWebhook({ ...webhook, enabled: true }, event, pretty);
}

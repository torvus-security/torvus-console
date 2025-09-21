import { NextResponse } from 'next/server';
import { requireStaff } from '../../../../lib/auth';
import { loadSecretsSummary, maskSecretTail } from '../../../../server/secrets';

function assertSecurityAdmin(roles: string[]): boolean {
  return roles.some((role) => role.toLowerCase() === 'security_admin');
}

export const dynamic = 'force-dynamic';

export async function GET() {
  const staffUser = await requireStaff();
  if (!assertSecurityAdmin(staffUser.roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const secrets = await loadSecretsSummary();
    const payload = secrets.map((secret) => ({
      key: secret.key,
      env: secret.env,
      version: secret.version,
      lastRotatedAt: secret.lastRotatedAt,
      lastAccessedAt: secret.lastAccessedAt,
      requiresDualControl: secret.requiresDualControl,
      maskedKey: maskSecretTail(secret.key, 6)
    }));
    return NextResponse.json({ secrets: payload });
  } catch (error) {
    console.error('[api][admin][secrets] failed to list secrets', error);
    return NextResponse.json({ error: 'Failed to load secrets' }, { status: 500 });
  }
}

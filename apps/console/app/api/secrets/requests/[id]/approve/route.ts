import { NextResponse } from 'next/server';
import { requireStaff } from '../../../../../../lib/auth';
import { approve } from '../../../../../../server/secrets';

function assertSecurityAdmin(roles: string[]): boolean {
  return roles.some((role) => role.toLowerCase() === 'security_admin');
}

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: { id: string } }
): Promise<NextResponse> {
  const staffUser = await requireStaff();
  if (!assertSecurityAdmin(staffUser.roles)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const requestId = context.params.id;
  if (!requestId || requestId.length < 10) {
    return NextResponse.json({ error: 'Invalid request id' }, { status: 400 });
  }

  try {
    const result = await approve(requestId, staffUser.id);
    return NextResponse.json({ status: result.status, approvals: result.approvals });
  } catch (error: any) {
    console.error('[api][secrets] failed to approve request', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to approve request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

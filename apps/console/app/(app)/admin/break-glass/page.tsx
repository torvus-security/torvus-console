import { PageHeader } from '../../../../components/PageHeader';
import {
  BreakGlassDashboard,
  type RoleOption,
  type StaffDirectoryEntry
} from '../../../../components/admin/BreakGlassDashboard';
import { createSupabaseServiceRoleClient } from '../../../../lib/supabase';
import { loadAuthz } from '../../../(lib)/authz';
import { DeniedPanel } from '../../../(lib)/denied-panel';

export const dynamic = 'force-dynamic';

function normaliseRole(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

export default async function BreakGlassAdminPage() {
  const authz = await loadAuthz();

  if (!authz.allowed || !authz.userId) {
    return <DeniedPanel message="Torvus Console access is limited to active staff." />;
  }

  const lowerRoles = new Set(authz.rolesLower);
  const canApprove = lowerRoles.has('security_admin');
  const canRequest = canApprove || lowerRoles.has('investigator');

  if (!canRequest) {
    console.warn('[authz] break-glass denied', {
      email: authz.email,
      assigned: authz.roles
    });
    return <DeniedPanel message="You need investigator or security administrator privileges to manage break-glass." />;
  }

  const supabase = createSupabaseServiceRoleClient<any>();

  const [{ data: staffRows, error: staffError }, { data: roleRows, error: roleError }] = await Promise.all([
    (supabase
      .from('staff_users') as any)
      .select('user_id, email, display_name')
      .order('email', { ascending: true }),
    (supabase
      .from('staff_roles') as any)
      .select('name, description')
      .order('name', { ascending: true })
  ]);

  if (staffError) {
    console.error('Failed to load staff directory for break-glass', staffError);
    return <DeniedPanel message="Unable to load staff data. Try again shortly." />;
  }

  if (roleError) {
    console.error('Failed to load role catalogue for break-glass', roleError);
    return <DeniedPanel message="Unable to load role catalogue. Try again shortly." />;
  }

  const staff: StaffDirectoryEntry[] = ((staffRows as Array<{
    user_id: string;
    email: string;
    display_name: string | null;
  }> | null) ?? []).map((row) => ({
    userId: row.user_id,
    email: row.email.toLowerCase(),
    displayName: row.display_name
  }));

  const roles: RoleOption[] = ((roleRows as Array<{ name: string | null; description: string | null }> | null) ?? [])
    .map((row) => ({
      name: normaliseRole(row.name),
      description: row.description?.trim() ?? ''
    }))
    .filter((role) => role.name.length > 0);

  return (
    <div className="flex flex-col gap-6 py-6">
      <PageHeader
        title="Break glass"
        description="Emergency elevated access workflows managed by security administrators."
      />
      <BreakGlassDashboard
        staff={staff}
        roles={roles}
        canRequest={canRequest}
        canApprove={canApprove}
        currentUserId={authz.userId}
      />
    </div>
  );
}

import { AccessDeniedNotice } from '../../../components/AccessDeniedNotice';
import {
  BreakGlassDashboard,
  type RoleOption,
  type StaffDirectoryEntry
} from '../../../components/admin/BreakGlassDashboard';
import { getStaffUser } from '../../../lib/auth';
import { createSupabaseServiceRoleClient } from '../../../lib/supabase';

export const dynamic = 'force-dynamic';

function normaliseRole(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

export default async function BreakGlassAdminPage() {
  const staffUser = await getStaffUser();

  if (!staffUser) {
    return <AccessDeniedNotice />;
  }

  const lowerRoles = staffUser.roles.map((role) => role.toLowerCase());
  const canApprove = lowerRoles.includes('security_admin');
  const canRequest = canApprove || lowerRoles.includes('investigator');

  if (!canRequest) {
    return <AccessDeniedNotice />;
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
    return <AccessDeniedNotice />;
  }

  if (roleError) {
    console.error('Failed to load role catalogue for break-glass', roleError);
    return <AccessDeniedNotice />;
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
    <BreakGlassDashboard
      staff={staff}
      roles={roles}
      canRequest={canRequest}
      canApprove={canApprove}
      currentUserId={staffUser.id}
    />
  );
}

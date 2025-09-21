import { AccessDeniedNotice } from '../../../components/AccessDeniedNotice';
import { ReadOnlySettingsForm } from '../../../components/admin/ReadOnlySettingsForm';
import { getStaffUser } from '../../../lib/auth';
import { createSupabaseServiceRoleClient } from '../../../lib/supabase';
import { getReadOnly } from '../../../server/settings';

export const dynamic = 'force-dynamic';

function hasSecurityAdminRole(roles: string[]): boolean {
  return roles.some((role) => role.toLowerCase() === 'security_admin');
}

async function loadRoleNames(): Promise<string[]> {
  const supabase = createSupabaseServiceRoleClient<any>();
  const { data, error } = await (supabase.from('staff_roles') as any)
    .select('name')
    .order('name', { ascending: true });

  if (error) {
    console.error('[admin][settings] failed to load role names', error);
    throw new Error('Unable to load role definitions');
  }

  const rows = (data as Array<{ name: string | null }> | null) ?? [];
  return rows
    .map((row) => row.name?.trim())
    .filter((name): name is string => Boolean(name));
}

export default async function AdminSettingsPage() {
  const staffUser = await getStaffUser();

  if (!staffUser || !hasSecurityAdminRole(staffUser.roles)) {
    return <AccessDeniedNotice />;
  }

  const [readOnly, roleNames] = await Promise.all([getReadOnly(), loadRoleNames()]);

  return (
    <div className="page">
      <ReadOnlySettingsForm initialState={readOnly} availableRoles={roleNames} />
    </div>
  );
}

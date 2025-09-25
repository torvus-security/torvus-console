import { ReadOnlySettingsForm } from '../../../components/admin/ReadOnlySettingsForm';
import { createSupabaseServiceRoleClient } from '../../../lib/supabase';
import { getReadOnly } from '../../../server/settings';
import { loadAuthz, authorizeRoles } from '../../(lib)/authz';
import { DeniedPanel } from '../../(lib)/denied-panel';

export const dynamic = 'force-dynamic';

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
  const authz = await loadAuthz();

  if (!authz.allowed) {
    return <DeniedPanel message="Torvus Console access is limited to active staff." />;
  }

  const isSecurityAdmin = authorizeRoles(authz, {
    anyOf: ['security_admin'],
    context: 'admin-settings'
  });

  if (!isSecurityAdmin) {
    return <DeniedPanel message="You need the security administrator role to manage console settings." />;
  }

  const [readOnly, roleNames] = await Promise.all([getReadOnly(), loadRoleNames()]);

  return (
    <div className="page">
      <ReadOnlySettingsForm initialState={readOnly} availableRoles={roleNames} />
    </div>
  );
}

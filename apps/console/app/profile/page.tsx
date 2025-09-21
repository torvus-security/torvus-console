import { revalidatePath } from 'next/cache';
import { ProfileForm, type ProfileFormState } from './ProfileForm';
import { getStaffUser } from '../../lib/auth';
import { createSupabaseServiceRoleClient } from '../../lib/supabase';
import { AccessDeniedNotice } from '../../components/AccessDeniedNotice';

async function saveProfileAction(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  'use server';

  const staffUser = await getStaffUser();
  if (!staffUser) {
    return { error: 'Access denied' };
  }

  const rawDisplayName = formData.get('displayName');
  const displayName = typeof rawDisplayName === 'string' ? rawDisplayName.trim() : '';

  if (!displayName) {
    return { error: 'Display name is required' };
  }

  if (displayName.length > 80) {
    return { error: 'Display name must be 80 characters or fewer' };
  }

  const supabase = createSupabaseServiceRoleClient();
  const identifierColumn = staffUser.id ? 'user_id' : 'email';
  const identifierValue = staffUser.id ?? staffUser.email;

  const { error, data } = await (supabase
    .from('staff_users') as any)
    .update({ display_name: displayName })
    .eq(identifierColumn, identifierValue)
    .select('user_id')
    .maybeSingle();

  if (error) {
    console.error('Failed to update staff display name', error);
    return { error: 'Unable to save profile. Try again shortly.' };
  }

  if (!data) {
    return { error: 'Staff profile not found' };
  }

  revalidatePath('/profile');
  revalidatePath('/', 'layout');

  return { success: true };
}

export default async function ProfilePage() {
  const staffUser = await getStaffUser();

  if (!staffUser) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <AccessDeniedNotice variant="card" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-3xl border border-slate-700 bg-slate-900/60 p-8 shadow-2xl">
        <div className="mb-8 flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-slate-100">My profile</h1>
          <p className="text-sm text-slate-400">
            Manage how your identity appears across audit trails and console workflows.
          </p>
        </div>
        <ProfileForm
          action={saveProfileAction}
          initialDisplayName={staffUser.displayName}
          email={staffUser.email}
          roles={staffUser.roles}
          passkeyEnrolled={staffUser.passkeyEnrolled}
        />
      </section>
    </div>
  );
}

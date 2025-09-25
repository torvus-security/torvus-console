import type { Metadata } from 'next';
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { Box, Button, Flex, Text } from '@radix-ui/themes';
import { ProfileForm, type ProfileFormState } from './ProfileForm';
import { getStaffUser } from '../../lib/auth';
import { createSupabaseServiceRoleClient } from '../../lib/supabase';
import { PersonalAccessTokensPanel } from './PersonalAccessTokensPanel';
import { enforceNotReadOnly, isReadOnlyError } from '../../server/guard';
import { PageHeader } from '../../components/PageHeader';
import { loadAuthz } from '../(lib)/authz';
import { DeniedPanel } from '../(lib)/denied-panel';

export const metadata: Metadata = {
  title: 'Profile',
};

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

  try {
    await enforceNotReadOnly(null, staffUser.roles, 'action.profile.update');
  } catch (error) {
    if (isReadOnlyError(error)) {
      return { error: error.message };
    }
    throw error;
  }

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
  const authz = await loadAuthz();

  if (!authz.allowed) {
    return (
      <Box py="9">
        <DeniedPanel message="Torvus Console access is limited to active staff." />
      </Box>
    );
  }

  const staffUser = await getStaffUser();

  if (!staffUser) {
    return (
      <Box py="9">
        <DeniedPanel />
      </Box>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Profile"
        description="Manage how your identity appears across audit trails and console workflows."
        actions={(
          <Flex align="center" gap="3" wrap="wrap">
            <Text size="2" color="gray">
              Signed in as {staffUser.displayName} ({staffUser.email})
            </Text>
            <Button color="iris" asChild>
              <Link href="/tokens">Manage tokens</Link>
            </Button>
          </Flex>
        )}
      />

      <Flex direction="column" gap="5">
        <Box className="rounded-3xl border border-slate-700 bg-slate-900/60 p-8 shadow-2xl">
          <ProfileForm
            action={saveProfileAction}
            initialDisplayName={staffUser.displayName}
            email={staffUser.email}
            roles={staffUser.roles}
            passkeyEnrolled={staffUser.passkeyEnrolled}
          />
        </Box>
        <PersonalAccessTokensPanel />
      </Flex>
    </div>
  );
}

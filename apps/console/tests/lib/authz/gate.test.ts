import { describe, expect, it, vi, beforeEach } from 'vitest';
import { evaluateAccessGate } from '../../../lib/authz/gate';
import type { PostgrestLikeOrSupabase } from '../../../lib/types';

type StubClient = PostgrestLikeOrSupabase & {
  __internals: {
    maybeSingle: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    ilike: ReturnType<typeof vi.fn>;
    isFn: ReturnType<typeof vi.fn>;
  };
};

function createStubClient(data: unknown, error: unknown = null): StubClient {
  const maybeSingle = vi.fn(async () => ({ data, error }));
  const isFn = vi.fn(() => ({ maybeSingle }));
  const ilike = vi.fn(() => ({ is: isFn, maybeSingle }));
  const select = vi.fn(() => ({ ilike, is: isFn, maybeSingle }));
  const from = vi.fn(() => ({ select }));

  return {
    from,
    __internals: { maybeSingle, select, ilike, isFn }
  } as unknown as StubClient;
}

describe('evaluateAccessGate', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('allows active, verified security admin', async () => {
    const client = createStubClient({
      user_id: 'user-123',
      email: 'admin@example.com',
      display_name: 'Admin Example',
      enrolled: true,
      verified: true,
      status: 'active',
      passkey_enrolled: true,
      staff_role_members: [
        {
          role_id: 'role-1',
          valid_to: null,
          staff_roles: { name: 'security_admin' }
        }
      ]
    });

    const result = await evaluateAccessGate('Admin@Example.com', { client });

    expect(client.from).toHaveBeenCalledWith('staff_users');
    expect(client.__internals.ilike).toHaveBeenCalledWith('email', 'admin@example.com');
    expect(client.__internals.isFn).toHaveBeenCalledWith('staff_role_members.valid_to', null);
    expect(result.allowed).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.flags).toEqual({
      enrolled: true,
      verified: true,
      status: 'active',
      passkey_enrolled: true
    });
    expect(result.roles).toEqual(['security_admin']);
    expect(result.roleIds).toEqual(['role-1']);
    expect(result.userId).toBe('user-123');
    expect(result.displayName).toBe('Admin Example');
  });

  it('denies when not enrolled', async () => {
    const client = createStubClient({
      user_id: 'user-456',
      email: 'pending@example.com',
      display_name: null,
      enrolled: false,
      verified: true,
      status: 'active',
      passkey_enrolled: false,
      staff_role_members: [
        {
          role_id: 'role-2',
          valid_to: null,
          staff_roles: { name: 'security_admin' }
        }
      ]
    });

    const result = await evaluateAccessGate('pending@example.com', { client });

    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain('enrollment incomplete');
    expect(result.flags.enrolled).toBe(false);
  });

  it('denies when status not active', async () => {
    const client = createStubClient({
      user_id: 'user-789',
      email: 'disabled@example.com',
      display_name: null,
      enrolled: true,
      verified: true,
      status: 'suspended',
      passkey_enrolled: true,
      staff_role_members: [
        {
          role_id: 'role-3',
          valid_to: null,
          staff_roles: { name: 'security_admin' }
        }
      ]
    });

    const result = await evaluateAccessGate('disabled@example.com', { client });

    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain('staff status is suspended');
  });

  it('denies when missing required role', async () => {
    const client = createStubClient({
      user_id: 'user-999',
      email: 'observer@example.com',
      display_name: null,
      enrolled: true,
      verified: true,
      status: 'active',
      passkey_enrolled: false,
      staff_role_members: [
        {
          role_id: 'role-4',
          valid_to: null,
          staff_roles: { name: 'observer' }
        }
      ]
    });

    const result = await evaluateAccessGate('observer@example.com', { client });

    expect(result.allowed).toBe(false);
    expect(result.roles).toEqual(['observer']);
    expect(result.reasons).toContain('missing required role security_admin or auditor');
  });
});

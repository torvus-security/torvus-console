import { describe, expect, it, vi } from 'vitest';
import { getIdentityFromRequestHeaders, getUserRolesByEmail, getStaffUserByEmail } from '../../lib/auth';

describe('getIdentityFromRequestHeaders', () => {
  it('prefers override header and normalises casing', () => {
    const headerBag = new Headers({
      'x-torvus-console-email': ' Admin@Example.com ',
      'cf-access-authenticated-user-email': 'auditor@example.com'
    });

    expect(getIdentityFromRequestHeaders(headerBag)).toEqual({
      email: 'admin@example.com',
      source: 'torvus'
    });
  });

  it('falls back to Cloudflare header when override missing', () => {
    const headerBag = new Headers({
      'cf-access-authenticated-user-email': 'auditor@example.com '
    });

    expect(getIdentityFromRequestHeaders(headerBag)).toEqual({
      email: 'auditor@example.com',
      source: 'cloudflare'
    });
  });

  it('falls back to authenticated user header when Cloudflare absent', () => {
    const headerBag = new Headers({
      'x-authenticated-user-email': 'observer@example.com'
    });

    expect(getIdentityFromRequestHeaders(headerBag)).toEqual({
      email: 'observer@example.com',
      source: 'cloudflare'
    });
  });

  it('returns anonymous identity when headers missing', () => {
    const headerBag = new Headers();

    expect(getIdentityFromRequestHeaders(headerBag)).toEqual({ source: 'anonymous' });
  });
});

describe('getUserRolesByEmail', () => {
  it('returns sorted unique role names', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));

    const maybeSingle = vi.fn(async () => ({
      data: {
        staff_role_members: [
          {
            staff_roles: { name: 'security_admin' },
            role_id: '1',
            valid_to: '2024-01-02T00:00:00Z'
          },
          { staff_roles: { name: 'investigator' }, role_id: '2', valid_to: null },
          {
            staff_roles: { name: 'security_admin' },
            role_id: '1',
            valid_to: '2023-12-31T23:00:00Z'
          }
        ]
      },
      error: null
    }));

    const isFn = vi.fn(() => ({ maybeSingle }));
    const ilike = vi.fn(() => ({ is: isFn, maybeSingle }));
    const select = vi.fn(() => ({ ilike, is: isFn, maybeSingle }));
    const from = vi.fn(() => ({ select }));

    const client = { from } as unknown as Parameters<typeof getUserRolesByEmail>[1];

    try {
      const roles = await getUserRolesByEmail('Admin@Example.com', client);

      expect(from).toHaveBeenCalledWith('staff_users');
      expect(ilike).toHaveBeenCalledWith('email', 'admin@example.com');
      expect(isFn).toHaveBeenCalledWith('staff_role_members.valid_to', null);
      expect(roles).toEqual(['investigator', 'security_admin']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns empty array when email missing', async () => {
    const from = vi.fn();
    const client = { from } as unknown as Parameters<typeof getUserRolesByEmail>[1];

    const roles = await getUserRolesByEmail('   ', client);

    expect(roles).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it('returns empty array when record not found', async () => {
    const maybeSingle = vi.fn(async () => ({ data: null, error: { code: 'PGRST116' } }));
    const isFn = vi.fn(() => ({ maybeSingle }));
    const ilike = vi.fn(() => ({ is: isFn, maybeSingle }));
    const select = vi.fn(() => ({ ilike, is: isFn, maybeSingle }));
    const from = vi.fn(() => ({ select }));

    const client = { from } as unknown as Parameters<typeof getUserRolesByEmail>[1];

    const roles = await getUserRolesByEmail('unknown@example.com', client);

    expect(roles).toEqual([]);
  });
});

describe('getStaffUserByEmail', () => {
  it('matches mixed-case email records', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: { user_id: 'user-1', email: 'ADMIN@Example.com', display_name: 'Admin Example' },
      error: null
    }));

    const ilike = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ ilike, maybeSingle }));
    const from = vi.fn(() => ({ select }));

    const client = { from } as unknown as Parameters<typeof getStaffUserByEmail>[1];

    const record = await getStaffUserByEmail('Admin@Example.com', client);

    expect(from).toHaveBeenCalledWith('staff_users');
    expect(ilike).toHaveBeenCalledWith('email', 'admin@example.com');
    expect(record).toEqual({
      user_id: 'user-1',
      email: 'admin@example.com',
      display_name: 'Admin Example'
    });
  });
});

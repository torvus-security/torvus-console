import { describe, expect, it, vi } from 'vitest';
import { getRequesterEmail, getUserRolesByEmail } from '../../lib/auth';

describe('getRequesterEmail', () => {
  it('prefers authenticated staff header and normalises casing', () => {
    const request = new Request('https://example.com', {
      headers: {
        'x-authenticated-staff-email': ' Admin@Example.com '
      }
    });

    expect(getRequesterEmail(request)).toBe('admin@example.com');
  });

  it('falls back to session user header', () => {
    const request = new Request('https://example.com', {
      headers: {
        'x-session-user-email': 'user@example.com'
      }
    });

    expect(getRequesterEmail(request)).toBe('user@example.com');
  });

  it('does not trust spoofed Cloudflare email header', () => {
    const request = new Request('https://example.com', {
      headers: {
        'cf-access-authenticated-user-email': 'attacker@example.com'
      }
    });

    expect(getRequesterEmail(request)).toBeNull();
  });

  it('returns null when no header present', () => {
    const request = new Request('https://example.com');

    expect(getRequesterEmail(request)).toBeNull();
  });
});

describe('getUserRolesByEmail', () => {
  it('returns sorted unique role names', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        staff_role_members: [
          { staff_roles: { name: 'security_admin' }, role_id: '1', valid_to: null },
          { staff_roles: { name: 'investigator' }, role_id: '2', valid_to: null },
          { staff_roles: { name: 'security_admin' }, role_id: '1', valid_to: null }
        ]
      },
      error: null
    }));

    const isFn = vi.fn(() => ({ maybeSingle }));
    const eq = vi.fn(() => ({ is: isFn, maybeSingle }));
    const select = vi.fn(() => ({ eq, is: isFn, maybeSingle }));
    const from = vi.fn(() => ({ select }));

    const client = { from } as unknown as Parameters<typeof getUserRolesByEmail>[1];

    const roles = await getUserRolesByEmail('Admin@Example.com', client);

    expect(from).toHaveBeenCalledWith('staff_users');
    expect(eq).toHaveBeenCalledWith('email', 'admin@example.com');
    expect(isFn).toHaveBeenCalledWith('staff_role_members.valid_to', null);
    expect(roles).toEqual(['investigator', 'security_admin']);
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
    const eq = vi.fn(() => ({ is: isFn, maybeSingle }));
    const select = vi.fn(() => ({ eq, is: isFn, maybeSingle }));
    const from = vi.fn(() => ({ select }));

    const client = { from } as unknown as Parameters<typeof getUserRolesByEmail>[1];

    const roles = await getUserRolesByEmail('unknown@example.com', client);

    expect(roles).toEqual([]);
  });
});

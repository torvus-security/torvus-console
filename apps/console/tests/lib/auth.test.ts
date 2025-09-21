import { describe, expect, it, vi } from 'vitest';
import { getRequesterEmail, getUserRolesByEmail } from '../../lib/auth';

describe('getRequesterEmail', () => {
  it('resolves email from Cloudflare header and normalises casing', () => {
    const request = new Request('https://example.com', {
      headers: {
        'Cf-Access-Authenticated-User-Email': ' Admin@Example.com '
      }
    });

    expect(getRequesterEmail(request)).toBe('admin@example.com');
  });

  it('falls back to x-user-email header', () => {
    const request = new Request('https://example.com', {
      headers: {
        'x-user-email': 'user@example.com'
      }
    });

    expect(getRequesterEmail(request)).toBe('user@example.com');
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
          { staff_roles: { name: 'security_admin' } },
          { staff_roles: { name: 'investigator' } },
          { staff_roles: { name: 'security_admin' } }
        ]
      },
      error: null
    }));

    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    const client = { from } as unknown as Parameters<typeof getUserRolesByEmail>[1];

    const roles = await getUserRolesByEmail('Admin@Example.com', client);

    expect(from).toHaveBeenCalledWith('staff_users');
    expect(eq).toHaveBeenCalledWith('email', 'admin@example.com');
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
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    const client = { from } as unknown as Parameters<typeof getUserRolesByEmail>[1];

    const roles = await getUserRolesByEmail('unknown@example.com', client);

    expect(roles).toEqual([]);
  });
});

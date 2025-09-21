import { describe, it, expect, beforeEach } from 'vitest';
import { ROLE_PERMISSIONS, hasPermission, resetPermissionCache, expandPermissionsForRoles } from '../lib/rbac';

describe('RBAC guard', () => {
  beforeEach(() => {
    resetPermissionCache();
  });

  it('grants viewer baseline permissions', () => {
    const permissions = ROLE_PERMISSIONS.viewer;
    expect(hasPermission(permissions, 'metrics.view')).toBe(true);
    expect(hasPermission(permissions, 'audit.read')).toBe(true);
    expect(hasPermission(permissions, 'audit.export')).toBe(false);
  });

  it('auditor can export evidence but cannot run simulators', () => {
    const permissions = ROLE_PERMISSIONS.auditor;
    expect(hasPermission(permissions, 'audit.export')).toBe(true);
    expect(hasPermission(permissions, 'releases.simulate')).toBe(false);
    expect(hasPermission(permissions, 'investigations.view')).toBe(true);
    expect(hasPermission(permissions, 'investigations.manage')).toBe(false);
  });

  it('operator can simulate but not execute releases', () => {
    const permissions = ROLE_PERMISSIONS.operator;
    expect(hasPermission(permissions, 'releases.simulate')).toBe(true);
    expect(hasPermission(permissions, 'releases.execute')).toBe(false);
  });

  it('investigator can manage investigations but lacks staff admin rights', () => {
    const permissions = ROLE_PERMISSIONS.investigator;
    expect(hasPermission(permissions, 'investigations.view')).toBe(true);
    expect(hasPermission(permissions, 'investigations.manage')).toBe(true);
    expect(hasPermission(permissions, 'staff.manage')).toBe(false);
  });

  it('security_admin inherits all permissions including staff.manage', () => {
    const permissions = ROLE_PERMISSIONS.security_admin;
    expect(hasPermission(permissions, 'staff.manage')).toBe(true);
    expect(hasPermission(permissions, 'policy.edit')).toBe(true);
  });

  it('break_glass maintains full access matrix', () => {
    const permissions = ROLE_PERMISSIONS.break_glass;
    expect(hasPermission(permissions, 'audit.read')).toBe(true);
    expect(hasPermission(permissions, 'releases.execute')).toBe(true);
  });

  it('expands unique permissions when multiple roles assigned', () => {
    const merged = expandPermissionsForRoles(['viewer', 'auditor', 'operator']);
    expect(merged).toContain('metrics.view');
    expect(merged).toContain('audit.export');
    expect(merged).toContain('releases.simulate');
    expect(merged).not.toContain('releases.execute');
  });
});

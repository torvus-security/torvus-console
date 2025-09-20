export type RoleKey = 'viewer' | 'auditor' | 'operator' | 'security_admin' | 'break_glass';

export type PermissionKey =
  | 'metrics.view'
  | 'audit.read'
  | 'audit.export'
  | 'releases.simulate'
  | 'releases.execute'
  | 'policy.edit'
  | 'staff.manage';

export interface StaffSubject {
  id: string;
  permissions: PermissionKey[];
}

export const ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  viewer: ['metrics.view', 'audit.read'],
  auditor: ['metrics.view', 'audit.read', 'audit.export'],
  operator: ['metrics.view', 'audit.read', 'releases.simulate'],
  security_admin: [
    'metrics.view',
    'audit.read',
    'audit.export',
    'releases.simulate',
    'releases.execute',
    'policy.edit',
    'staff.manage'
  ],
  break_glass: [
    'metrics.view',
    'audit.read',
    'audit.export',
    'releases.simulate',
    'releases.execute',
    'policy.edit',
    'staff.manage'
  ]
};

const permissionCache = new WeakMap<object, Set<PermissionKey>>();

export function expandPermissionsForRoles(roles: RoleKey[]): PermissionKey[] {
  const permissions = new Set<PermissionKey>();
  for (const role of roles) {
    const rolePermissions = ROLE_PERMISSIONS[role];
    rolePermissions?.forEach((permission) => permissions.add(permission));
  }
  return Array.from(permissions);
}

function resolveCache(subject: StaffSubject | PermissionKey[]): Set<PermissionKey> {
  if (Array.isArray(subject)) {
    return new Set(subject);
  }

  if (!permissionCache.has(subject)) {
    permissionCache.set(subject, new Set(subject.permissions));
  }

  return permissionCache.get(subject)!;
}

export function hasPermission(subject: StaffSubject | PermissionKey[], permission: PermissionKey): boolean {
  return resolveCache(subject).has(permission);
}

export function assertPermission(subject: StaffSubject | PermissionKey[], permission: PermissionKey) {
  if (!hasPermission(subject, permission)) {
    throw new Error(`Missing permission: ${permission}`);
  }
}

export function resetPermissionCache() {
  permissionCache.clear();
}

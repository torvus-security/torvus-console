import { randomUUID, createHash } from 'node:crypto';
import type { PermissionKey } from './rbac';

export type AnalyticsEventKey =
  | 'staff_console_viewed'
  | 'audit_events_exported'
  | 'release_simulated'
  | 'dual_control_requested'
  | 'dual_control_approved'
  | 'dual_control_executed';

type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

type NavItem = {
  href: string;
  label: string;
  permission?: PermissionKey;
  group?: 'Operations' | 'Security' | 'Admin' | 'Account';
};

const NAV_ITEMS: NavItem[] = [
  { href: '/overview', label: 'Overview', permission: 'metrics.view', group: 'Operations' },
  { href: '/alerts', label: 'Alerts', group: 'Operations' },
  { href: '/investigations', label: 'Investigations', permission: 'investigations.view', group: 'Operations' },
  { href: '/releases', label: 'Releases', permission: 'releases.simulate', group: 'Operations' },
  { href: '/audit', label: 'Audit trail', permission: 'audit.read', group: 'Security' },
  { href: '/admin/break-glass', label: 'Break Glass', permission: 'investigations.manage', group: 'Security' },
  { href: '/profile', label: 'Profile', group: 'Account' }
];

const NAV_GROUP_ORDER: Array<NonNullable<NavItem['group']>> = ['Operations', 'Security', 'Account', 'Admin'];

class AnalyticsClient {
  private readonly queue: Array<{ event: AnalyticsEventKey; payload: AnalyticsPayload }> = [];
  private readonly host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  private readonly key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  capture(event: AnalyticsEventKey, payload: AnalyticsPayload = {}) {
    const body = {
      event,
      properties: {
        $lib: 'torvus-console',
        env: process.env.NODE_ENV ?? 'development',
        ...payload
      },
      uuid: randomUUID()
    };

    this.queue.push({ event, payload: body.properties });

    if (!this.host || !this.key) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[analytics]', event, body.properties);
      }
      return;
    }

    fetch(`${this.host}/capture/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }).catch((error) => {
      console.warn('Analytics capture failed', error);
    });
  }

  getQueue() {
    return [...this.queue];
  }
}

let client: AnalyticsClient | null = null;

export function getAnalyticsClient(): AnalyticsClient {
  if (!client) {
    client = new AnalyticsClient();
  }
  return client;
}

export function anonymiseEmail(email: string): string {
  const hash = createHash('sha256');
  hash.update(email.trim().toLowerCase());
  return hash.digest('hex');
}

type NavGroup = { group: string; items: Array<{ href: string; label: string }> };

export function buildNavItems(staffPermissions: PermissionKey[]): NavGroup[] {
  const groups = new Map<string, Array<{ href: string; label: string }>>();

  for (const item of NAV_ITEMS) {
    if (item.permission && !staffPermissions.includes(item.permission)) {
      continue;
    }

    const groupName = item.group ?? 'Operations';
    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }

    groups.get(groupName)!.push({ href: item.href, label: item.label });
  }

  const orderedGroups: NavGroup[] = [];
  for (const group of NAV_GROUP_ORDER) {
    const items = groups.get(group);
    if (items && items.length > 0) {
      orderedGroups.push({ group, items });
      groups.delete(group);
    }
  }

  for (const [group, items] of groups.entries()) {
    orderedGroups.push({ group, items });
  }

  return orderedGroups;
}

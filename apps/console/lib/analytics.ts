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

type NavItem = { href: string; label: string; permission?: PermissionKey };

const NAV_ITEMS: NavItem[] = [
  { href: '/overview', label: 'Overview', permission: 'metrics.view' },
  { href: '/audit-events', label: 'Audit Events', permission: 'audit.read' },
  { href: '/releases', label: 'Releases', permission: 'releases.simulate' }
];

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

export function buildNavItems(staffPermissions: PermissionKey[]): Array<{ href: string; label: string }> {
  return NAV_ITEMS.filter((item) =>
    item.permission ? staffPermissions.includes(item.permission) : true
  ).map(({ href, label }) => ({ href, label }));
}

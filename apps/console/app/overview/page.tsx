import Link from 'next/link';
import { headers } from 'next/headers';
import clsx from 'clsx';
import { requireStaff } from '../../lib/auth';
import { getAnalyticsClient } from '../../lib/analytics';
import { countAlerts } from '../../lib/data/alerts';
import { countInvestigations } from '../../lib/data/investigations';

const DEFAULT_STATS = {
  activeAlerts: 0,
  openInvestigations: 0,
  releaseTrainStatus: 'idle',
  lastIncidentAt: null as string | null
};

async function loadOverviewStats(correlationId: string) {
  const endpoint = process.env.TORVUS_PLATFORM_STATS_URL ?? `${process.env.TORVUS_PLATFORM_URL ?? ''}/api/stats`;
  if (!endpoint) {
    return DEFAULT_STATS;
  }

  try {
    const response = await fetch(endpoint, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'X-Correlation-Id': correlationId
      }
    });

    if (!response.ok) {
      console.warn('Failed to load overview stats', response.statusText);
      return DEFAULT_STATS;
    }

    const json = await response.json();
    return {
      activeAlerts: json.activeAlerts ?? DEFAULT_STATS.activeAlerts,
      openInvestigations: json.openInvestigations ?? DEFAULT_STATS.openInvestigations,
      releaseTrainStatus: json.releaseTrainStatus ?? DEFAULT_STATS.releaseTrainStatus,
      lastIncidentAt: json.lastIncidentAt ?? DEFAULT_STATS.lastIncidentAt
    };
  } catch (error) {
    console.warn('Overview stats fetch failed', error);
    return DEFAULT_STATS;
  }
}

function formatDate(timestamp: string | null) {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    hour12: false,
    timeZone: 'UTC'
  });
}

function StatuspageEmbed({ correlationId }: { correlationId: string }) {
  const embedUrl = process.env.NEXT_PUBLIC_STATUSPAGE_URL
    ?? (process.env.NEXT_PUBLIC_STATUSPAGE_PAGE_ID
      ? `https://${process.env.NEXT_PUBLIC_STATUSPAGE_PAGE_ID}.statuspage.io` : null);

  if (!embedUrl) {
    return (
      <section className="panel" aria-labelledby="statuspage-heading">
        <div className="panel__header">
          <h2 id="statuspage-heading">Statuspage</h2>
          <span className="tag subtle">Not configured</span>
        </div>
        <p className="muted">Set NEXT_PUBLIC_STATUSPAGE_PAGE_ID to embed the production status page.</p>
      </section>
    );
  }

  return (
    <section className="panel" aria-labelledby="statuspage-heading">
      <div className="panel__header">
        <h2 id="statuspage-heading">Statuspage</h2>
      </div>
      <iframe
        src={`${embedUrl}/embed/status`}
        title="Torvus Statuspage"
        sandbox="allow-same-origin allow-scripts allow-popups"
        loading="lazy"
        referrerPolicy="no-referrer"
        className="iframe-status"
        data-correlation={correlationId}
      />
    </section>
  );
}

export default async function OverviewPage() {
  const staffUser = await requireStaff({ permission: 'metrics.view' });
  const headerBag = headers();
  const correlationId = headerBag.get('x-correlation-id') ?? crypto.randomUUID();
  const [stats, activeAlerts, openInvestigations] = await Promise.all([
    loadOverviewStats(correlationId),
    countAlerts(),
    countInvestigations()
  ]);

  const mergedStats = {
    ...stats,
    activeAlerts,
    openInvestigations
  };

  const isSecurityAdmin = staffUser.roles.some((role) => role.toLowerCase() === 'security_admin');

  const analytics = getAnalyticsClient();
  analytics.capture('staff_console_viewed', {
    path: '/overview',
    user: staffUser.analyticsId,
    correlation_id: correlationId
  });

  return (
    <div className="page">
      <div className="cards">
        <article className="card">
          <header>
            <h2>Active alerts</h2>
            <span className="metric">{mergedStats.activeAlerts}</span>
          </header>
          <p className="muted">Alerts open across Torvus platform services.</p>
        </article>
        <article className="card">
          <header>
            <h2>Open investigations</h2>
            <span className="metric">{mergedStats.openInvestigations}</span>
          </header>
          <p className="muted">Endpoint triage items assigned to Console operators.</p>
        </article>
        <article className="card">
          <header>
            <h2>Release train</h2>
            <span className={clsx('metric', mergedStats.releaseTrainStatus)}>{mergedStats.releaseTrainStatus}</span>
          </header>
          <p className="muted">Release execution remains feature-flagged pending dual-control validation.</p>
        </article>
        <article className="card">
          <header>
            <h2>Last incident</h2>
            <span className="metric">{formatDate(mergedStats.lastIncidentAt)}</span>
          </header>
          <p className="muted">UTC timestamp, pulled from audit trail for evidence parity.</p>
        </article>
        {isSecurityAdmin && (
          <article className="card">
            <header>
              <h2>Admin</h2>
            </header>
            <p className="muted">Manage people &amp; roles.</p>
            <Link
              href="/admin/people"
              className="mt-4 inline-flex items-center text-sm font-medium text-emerald-300 transition hover:text-emerald-200"
            >
              Open admin tools →
            </Link>
          </article>
        )}
      </div>

      <div className="grid-two">
        <StatuspageEmbed correlationId={correlationId} />
        <section className="panel" aria-labelledby="system-heading">
          <div className="panel__header">
            <h2 id="system-heading">System signals</h2>
            <span className="tag subtle">Read only</span>
          </div>
          <dl className="kv">
            <div>
              <dt>Environment</dt>
              <dd>{process.env.NODE_ENV}</dd>
            </div>
            <div>
              <dt>Feature flag</dt>
              <dd>{process.env.TORVUS_FEATURE_ENABLE_RELEASE_EXECUTION === '1' ? 'enabled' : 'disabled'}</dd>
            </div>
            <div>
              <dt>Supabase project</dt>
              <dd>{process.env.SUPABASE_URL ?? 'unset'}</dd>
            </div>
            <div>
              <dt>Correlation ID</dt>
              <dd>{correlationId}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}

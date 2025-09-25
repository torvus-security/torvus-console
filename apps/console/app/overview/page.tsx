import Link from 'next/link';
import { headers } from 'next/headers';
import { Button, Callout, Flex, Grid, Heading, Text } from '@radix-ui/themes';
import { requireStaff } from '../../lib/auth';
import { loadAuthz, authorizeRoles } from '../(lib)/authz';
import { DeniedPanel } from '../(lib)/denied-panel';
import { getAnalyticsClient } from '../../lib/analytics';
import { countAlerts } from '../../lib/data/alerts';
import { countInvestigations } from '../../lib/data/investigations';
import { isSupabaseConfigured } from '../../lib/supabase';
import { logAudit } from '../../server/audit';
import { PageHeader } from '../../components/PageHeader';
import { MetricCard } from '../../components/MetricCard';
import { Card } from '../../components/ui/card';

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

function formatReleaseStatus(status: string) {
  const normalized = status.replace(/_/g, ' ').trim();
  if (!normalized) {
    return 'Unknown';
  }
  return normalized
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function StatuspageEmbed({ correlationId }: { correlationId: string }) {
  const embedUrl = process.env.NEXT_PUBLIC_STATUSPAGE_URL
    ?? (process.env.NEXT_PUBLIC_STATUSPAGE_PAGE_ID
      ? `https://${process.env.NEXT_PUBLIC_STATUSPAGE_PAGE_ID}.statuspage.io` : null);

  if (!embedUrl) {
    return (
      <Card className="p-5" aria-labelledby="statuspage-heading">
        <Flex direction="column" gap="3">
          <Flex direction="column" gap="1">
            <Heading as="h2" id="statuspage-heading" size="3">
              Statuspage
            </Heading>
            <Text size="2" color="gray">
              Not configured
            </Text>
          </Flex>
          <Callout.Root color="gray" role="status">
            <Callout.Text>
              Set NEXT_PUBLIC_STATUSPAGE_PAGE_ID to embed the production status page.
            </Callout.Text>
          </Callout.Root>
        </Flex>
      </Card>
    );
  }

  return (
    <Card className="p-5" aria-labelledby="statuspage-heading">
      <Flex direction="column" gap="3">
        <Flex direction="column" gap="1">
          <Heading as="h2" id="statuspage-heading" size="3">
            Statuspage
          </Heading>
          <Text size="2" color="gray">
            Live platform status from the public page.
          </Text>
        </Flex>
        <div
          style={{
            borderRadius: 'var(--radius-3)',
            overflow: 'hidden',
            border: '1px solid var(--gray-5)'
          }}
        >
          <iframe
            src={`${embedUrl}/embed/status`}
            title="Torvus Statuspage"
            sandbox="allow-same-origin allow-scripts allow-popups"
            loading="lazy"
            referrerPolicy="no-referrer"
            style={{ width: '100%', minHeight: 240, border: '0' }}
            data-correlation={correlationId}
          />
        </div>
      </Flex>
    </Card>
  );
}

export default async function OverviewPage() {
  const authz = await loadAuthz();
  const headerBag = headers();
  const correlationId = headerBag.get('x-correlation-id') ?? crypto.randomUUID();
  const supabaseConfigured = isSupabaseConfigured();

  if (!supabaseConfigured) {
    return (
      <Flex direction="column" gap="6">
        <PageHeader title="Overview" description="Operations & security at a glance" />
        <Card className="p-5">
          <Text size="3" color="gray">
            Supabase configuration is required to display overview metrics.
          </Text>
        </Card>
      </Flex>
    );
  }

  if (!authz.allowed) {
    return (
      <Flex direction="column" gap="6">
        <PageHeader title="Overview" description="Operations & security at a glance" />
        <DeniedPanel message="Torvus Console access is limited to enrolled and active staff." />
      </Flex>
    );
  }

  const hasOverviewRole = authorizeRoles(authz, {
    anyOf: ['security_admin', 'auditor'],
    context: 'overview'
  });

  if (!hasOverviewRole) {
    return (
      <Flex direction="column" gap="6">
        <PageHeader title="Overview" description="Operations & security at a glance" />
        <DeniedPanel message="You need the security administrator or auditor role to view these metrics." />
      </Flex>
    );
  }

  const staffUser = await requireStaff({ permission: 'metrics.view' });
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

  const analytics = getAnalyticsClient();
  analytics.capture('staff_console_viewed', {
    path: '/overview',
    user: staffUser.analyticsId,
    correlation_id: correlationId
  });

  await logAudit({
    action: 'page_view',
    targetType: 'page',
    targetId: 'overview',
    resource: 'console.overview',
    meta: {
      active_alerts: mergedStats.activeAlerts,
      open_investigations: mergedStats.openInvestigations
    }
  });

  return (
    <Flex direction="column" gap="6">
      <PageHeader
        title="Overview"
        description="Operations & security at a glance"
        actions={(
          <Text size="2" color="gray">
            Signed in as {staffUser.displayName}
          </Text>
        )}
      />

      <Grid columns={{ initial: '1', sm: '2', lg: '4' }} gap="4" width="100%">
        <MetricCard
          title="Active alerts"
          description="Alerts open across Torvus platform services."
          value={`${mergedStats.activeAlerts}`}
        />
        <MetricCard
          title="Open investigations"
          description="Endpoint triage items assigned to Console operators."
          value={`${mergedStats.openInvestigations}`}
        />
        <MetricCard
          title="Release train"
          description="Execution status pending dual-control validation."
          value={formatReleaseStatus(mergedStats.releaseTrainStatus)}
          action={(
            <Button asChild variant="surface">
              <Link href="/releases">Go to Releases</Link>
            </Button>
          )}
        />
        <MetricCard
          title="Last incident"
          description="UTC timestamp pulled from the audit trail."
          value={formatDate(mergedStats.lastIncidentAt)}
        />
      </Grid>

      <Grid columns={{ initial: '1', lg: '2' }} gap="5">
        <StatuspageEmbed correlationId={correlationId} />
        <Card className="p-5" aria-labelledby="system-heading">
          <Flex direction="column" gap="3">
            <Flex direction="column" gap="1">
              <Heading as="h2" id="system-heading" size="3">
                System signals
              </Heading>
              <Text size="2" color="gray">
                Read only
              </Text>
            </Flex>
            <dl>
              <Grid columns={{ initial: '1', sm: '2' }} gap="3">
                <Flex direction="column" gap="1">
                  <Text as="span" size="2" color="gray">
                    Environment
                  </Text>
                  <Text as="span" size="3">
                    {process.env.NODE_ENV}
                  </Text>
                </Flex>
                <Flex direction="column" gap="1">
                  <Text as="span" size="2" color="gray">
                    Feature flag
                  </Text>
                  <Text as="span" size="3">
                    {process.env.TORVUS_FEATURE_ENABLE_RELEASE_EXECUTION === '1' ? 'enabled' : 'disabled'}
                  </Text>
                </Flex>
                <Flex direction="column" gap="1">
                  <Text as="span" size="2" color="gray">
                    Supabase project
                  </Text>
                  <Text as="span" size="3">
                    {process.env.SUPABASE_URL ?? 'unset'}
                  </Text>
                </Flex>
                <Flex direction="column" gap="1">
                  <Text as="span" size="2" color="gray">
                    Correlation ID
                  </Text>
                  <Text as="span" size="3">
                    {correlationId}
                  </Text>
                </Flex>
              </Grid>
            </dl>
          </Flex>
        </Card>
      </Grid>
    </Flex>
  );
}

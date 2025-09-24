import Link from 'next/link';
import { headers } from 'next/headers';
import {
  Box,
  Button,
  Callout,
  Card,
  Flex,
  Grid,
  Heading,
  Text
} from '@radix-ui/themes';
import { requireStaff } from '../../lib/auth';
import { getAnalyticsClient } from '../../lib/analytics';
import { countAlerts } from '../../lib/data/alerts';
import { countInvestigations } from '../../lib/data/investigations';
import { isSupabaseConfigured } from '../../lib/supabase';
import { logAudit } from '../../server/audit';
import { PageHeader } from '../../components/PageHeader';

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
      <Card size="3" aria-labelledby="statuspage-heading">
        <Flex direction="column" gap="3">
          <Box>
            <Heading as="h2" id="statuspage-heading" size="3">
              Statuspage
            </Heading>
            <Text size="2" color="gray" mt="1">
              Not configured
            </Text>
          </Box>
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
    <Card size="3" aria-labelledby="statuspage-heading">
      <Flex direction="column" gap="3">
        <Box>
          <Heading as="h2" id="statuspage-heading" size="3">
            Statuspage
          </Heading>
          <Text size="2" color="gray" mt="1">
            Live platform status from the public page.
          </Text>
        </Box>
        <Box
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
        </Box>
      </Flex>
    </Card>
  );
}

export default async function OverviewPage() {
  const headerBag = headers();
  const correlationId = headerBag.get('x-correlation-id') ?? crypto.randomUUID();
  const supabaseConfigured = isSupabaseConfigured();

  if (!supabaseConfigured) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Overview" description="Operations & security at a glance" />
        <Card size="3">
          <Text size="3" color="gray">
            Supabase configuration is required to display overview metrics.
          </Text>
        </Card>
      </div>
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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overview"
        description="Operations & security at a glance"
        actions={(
          <Text size="2" color="gray">
            Signed in as {staffUser.displayName}
          </Text>
        )}
      />

      <Grid
        columns={{ initial: '1', sm: '2', lg: '4' }}
        gap={{ initial: '3', sm: '4' }}
        width="100%"
      >
        <Card size="3">
          <Flex direction="column" gap="3">
            <Box>
              <Heading as="h2" size="3">
                Active alerts
              </Heading>
              <Text size="2" color="gray" mt="1">
                Alerts open across Torvus platform services.
              </Text>
            </Box>
            {mergedStats.activeAlerts > 0 ? (
              <Text size="6" weight="medium">
                {mergedStats.activeAlerts} active {mergedStats.activeAlerts === 1 ? 'alert' : 'alerts'}
              </Text>
            ) : (
              <Callout.Root color="gray" role="status">
                <Callout.Text>No alerts yet</Callout.Text>
              </Callout.Root>
            )}
          </Flex>
        </Card>

        <Card size="3">
          <Flex direction="column" gap="3">
            <Box>
              <Heading as="h2" size="3">
                Open investigations
              </Heading>
              <Text size="2" color="gray" mt="1">
                Endpoint triage items assigned to Console operators.
              </Text>
            </Box>
            {mergedStats.openInvestigations > 0 ? (
              <Text size="6" weight="medium">
                {mergedStats.openInvestigations} open {mergedStats.openInvestigations === 1 ? 'investigation' : 'investigations'}
              </Text>
            ) : (
              <Text size="3" color="gray">
                None
              </Text>
            )}
          </Flex>
        </Card>

        <Card size="3">
          <Flex direction="column" gap="3">
            <Box>
              <Heading as="h2" size="3">
                Release train
              </Heading>
              <Text size="2" color="gray" mt="1">
                Release execution remains feature-flagged pending dual-control validation.
              </Text>
            </Box>
            <Flex direction="column" gap="3">
              <Text size="3" weight="medium">
                {formatReleaseStatus(mergedStats.releaseTrainStatus)}
              </Text>
              <Button asChild variant="surface">
                <Link href="/releases">
                  Go to Releases
                </Link>
              </Button>
            </Flex>
          </Flex>
        </Card>

        <Card size="3">
          <Flex direction="column" gap="3">
            <Box>
              <Heading as="h2" size="3">
                Last incident
              </Heading>
              <Text size="2" color="gray" mt="1">
                UTC timestamp pulled from audit trail for evidence parity.
              </Text>
            </Box>
            <Text size="3" weight="medium">
              {formatDate(mergedStats.lastIncidentAt)}
            </Text>
          </Flex>
        </Card>
      </Grid>

      <Grid columns={{ initial: '1', lg: '2' }} gap={{ initial: '4', lg: '5' }} mt="6">
        <StatuspageEmbed correlationId={correlationId} />
        <Card size="3" aria-labelledby="system-heading">
          <Flex direction="column" gap="3">
            <Box>
              <Heading as="h2" id="system-heading" size="3">
                System signals
              </Heading>
              <Text size="2" color="gray" mt="1">
                Read only
              </Text>
            </Box>
            <Box asChild>
              <dl>
                <Grid columns={{ initial: '1', sm: '2' }} gap="3">
                  <Flex direction="column" gap="1">
                    <Box asChild>
                      <dt>
                        <Text as="span" size="2" color="gray">
                          Environment
                        </Text>
                      </dt>
                    </Box>
                    <Box asChild>
                      <dd>
                        <Text as="span" size="3">
                          {process.env.NODE_ENV}
                        </Text>
                      </dd>
                    </Box>
                  </Flex>
                  <Flex direction="column" gap="1">
                    <Box asChild>
                      <dt>
                        <Text as="span" size="2" color="gray">
                          Feature flag
                        </Text>
                      </dt>
                    </Box>
                    <Box asChild>
                      <dd>
                        <Text as="span" size="3">
                          {process.env.TORVUS_FEATURE_ENABLE_RELEASE_EXECUTION === '1' ? 'enabled' : 'disabled'}
                        </Text>
                      </dd>
                    </Box>
                  </Flex>
                  <Flex direction="column" gap="1">
                    <Box asChild>
                      <dt>
                        <Text as="span" size="2" color="gray">
                          Supabase project
                        </Text>
                      </dt>
                    </Box>
                    <Box asChild>
                      <dd>
                        <Text as="span" size="3">
                          {process.env.SUPABASE_URL ?? 'unset'}
                        </Text>
                      </dd>
                    </Box>
                  </Flex>
                  <Flex direction="column" gap="1">
                    <Box asChild>
                      <dt>
                        <Text as="span" size="2" color="gray">
                          Correlation ID
                        </Text>
                      </dt>
                    </Box>
                    <Box asChild>
                      <dd>
                        <Text as="span" size="3">
                          {correlationId}
                        </Text>
                      </dd>
                    </Box>
                  </Flex>
                </Grid>
              </dl>
            </Box>
          </Flex>
        </Card>
      </Grid>
    </div>
  );
}

import { headers } from 'next/headers';
import { requireStaff } from '../../lib/auth';
import { createSupabaseServiceRoleClient } from '../../lib/supabase';
import { getAnalyticsClient } from '../../lib/analytics';
import { SimulationForm } from './simulation-form';
import { simulateReleaseAction } from './actions';

const RELEASE_QUERY_LIMIT = 20;

type ReleaseDecision = {
  id: string;
  version: string;
  decided_at: string;
  decided_by: string;
  status: string;
  notes: string | null;
};

async function loadReleaseDecisions(): Promise<ReleaseDecision[]> {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from('release_decisions')
    .select('id, version, decided_at, decided_by, status, notes')
    .order('decided_at', { ascending: false })
    .limit(RELEASE_QUERY_LIMIT);

  if (error) {
    console.error('Failed to load release decisions', error);
    return [];
  }

  return (data ?? []) as ReleaseDecision[];
}

export default async function ReleasesPage() {
  const staffUser = await requireStaff({ permission: 'releases.simulate' });
  const headerBag = headers();
  const correlationId = headerBag.get('x-correlation-id') ?? crypto.randomUUID();
  const releases = await loadReleaseDecisions();

  const analytics = getAnalyticsClient();
  analytics.capture('staff_console_viewed', {
    path: '/releases',
    correlation_id: correlationId,
    user: staffUser.analyticsId,
    env: process.env.NODE_ENV ?? 'development'
  });

  return (
    <div className="page">
      <section className="panel" aria-labelledby="releases-heading">
        <div className="panel__header">
          <h1 id="releases-heading">Recent release decisions</h1>
          <span className="tag subtle">Read only</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th scope="col">Version</th>
                <th scope="col">Status</th>
                <th scope="col">Decided at</th>
                <th scope="col">Decided by</th>
                <th scope="col">Notes</th>
              </tr>
            </thead>
            <tbody>
              {releases.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">No release decisions recorded yet.</td>
                </tr>
              )}
              {releases.map((release) => (
                <tr key={release.id}>
                  <td>{release.version}</td>
                  <td>{release.status}</td>
                  <td>{new Date(release.decided_at).toISOString()}</td>
                  <td>{release.decided_by}</td>
                  <td>{release.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <SimulationForm action={simulateReleaseAction} />
    </div>
  );
}

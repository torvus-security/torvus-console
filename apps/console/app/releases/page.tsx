import { headers } from 'next/headers';
import { z } from 'zod';
import { requireStaff } from '../../lib/auth';
import { createSupabaseServiceRoleClient } from '../../lib/supabase';
import { getAnalyticsClient } from '../../lib/analytics';
import { SimulationForm, type SimulationResultState } from './simulation-form';

const SimulationInput = z.object({
  releaseId: z.string().min(3).max(64),
  notes: z.string().max(240).optional()
});

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

async function callReleaseSimulator(payload: { releaseId: string; notes?: string }, correlationId: string) {
  const endpoint = process.env.TORVUS_RELEASE_SIMULATOR_URL;
  if (!endpoint) {
    return {
      ok: true,
      message: 'Simulator endpoint not configured; returning dry-run success.',
      correlationId
    } satisfies SimulationResultState;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-Id': correlationId
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        ok: false,
        message: `Simulator error (${response.status}): ${text}`,
        correlationId
      } satisfies SimulationResultState;
    }

    const json = await response.json();

    return {
      ok: true,
      message: json.message ?? 'Simulation completed successfully.',
      correlationId
    } satisfies SimulationResultState;
  } catch (error: any) {
    return {
      ok: false,
      message: `Simulation request failed: ${error.message ?? error}`,
      correlationId
    } satisfies SimulationResultState;
  }
}

export async function simulateReleaseAction(
  _prevState: SimulationResultState,
  formData: FormData
): Promise<SimulationResultState> {
  'use server';
  const staffUser = await requireStaff({ permission: 'releases.simulate' });
  const parsed = SimulationInput.safeParse(Object.fromEntries(formData.entries()));
  const correlationId = crypto.randomUUID();

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Invalid simulation input. Confirm release identifier and try again.',
      correlationId
    };
  }

  const result = await callReleaseSimulator(parsed.data, correlationId);
  const analytics = getAnalyticsClient();
  analytics.capture('release_simulated', {
    user: staffUser.analyticsId,
    release_id: parsed.data.releaseId,
    ok: result.ok,
    correlation_id: correlationId,
    env: process.env.NODE_ENV ?? 'development'
  });

  return result;
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

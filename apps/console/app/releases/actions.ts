'use server';

import { z } from 'zod';
import { requireStaff } from '../../lib/auth';
import { getAnalyticsClient } from '../../lib/analytics';
import type { SimulationResultState } from './types';

const SimulationInput = z.object({
  releaseId: z.string().min(3).max(64),
  notes: z.string().max(240).optional()
});

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

  const payload = parsed.data as { releaseId: string; notes?: string };
  const result = await callReleaseSimulator(payload, correlationId);
  const analytics = getAnalyticsClient();
  analytics.capture('release_simulated', {
    user: staffUser.analyticsId,
    release_id: payload.releaseId,
    ok: result.ok,
    correlation_id: correlationId,
    env: process.env.NODE_ENV ?? 'development'
  });

  return result;
}

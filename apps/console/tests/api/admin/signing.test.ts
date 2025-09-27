import { beforeEach, describe, expect, it, vi } from 'vitest';

const modulePaths = vi.hoisted(() => ({
  auth: new URL('../../../lib/auth.ts', import.meta.url).pathname,
  supabaseAdmin: new URL('../../../lib/supabase/admin.ts', import.meta.url).pathname,
  signingRpc: new URL('../../../lib/rpc/signing.ts', import.meta.url).pathname
}));

vi.mock(modulePaths.auth, () => ({
  getIdentityFromRequestHeaders: vi.fn(() => ({ email: 'user@example.com', source: 'cloudflare' })),
  getUserRolesByEmail: vi.fn(async () => [])
}));

vi.mock(modulePaths.supabaseAdmin, () => ({
  createSupabaseServiceRoleClient: vi.fn(() => ({}))
}));

vi.mock(modulePaths.signingRpc, () => ({
  getSigningJob: vi.fn(),
  getSigningReceipt: vi.fn(),
  listSigningJobs: vi.fn()
}));

import { getUserRolesByEmail } from '../../../lib/auth';
import { createSupabaseServiceRoleClient } from '../../../lib/supabase/admin';
import { getSigningJob, getSigningReceipt, listSigningJobs } from '../../../lib/rpc/signing';
import * as jobDetailRoute from '../../../app/api/admin/signing/jobs/[id]/route';
import * as jobListRoute from '../../../app/api/admin/signing/jobs/route';
import * as receiptRoute from '../../../app/api/admin/signing/receipts/[id]/route';

const getUserRolesByEmailMock = vi.mocked(getUserRolesByEmail);
const createSupabaseServiceRoleClientMock = vi.mocked(createSupabaseServiceRoleClient);
const getSigningJobMock = vi.mocked(getSigningJob);
const listSigningJobsMock = vi.mocked(listSigningJobs);
const getSigningReceiptMock = vi.mocked(getSigningReceipt);

describe('admin signing routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserRolesByEmailMock.mockResolvedValue([]);
  });

  it('returns 403 for non-staff signing job detail requests', async () => {
    const response = await jobDetailRoute.GET(
      new Request('https://example.com/api/admin/signing/jobs/job-1'),
      { params: { id: 'job-1' } }
    );

    expect(response.status).toBe(403);
    expect(createSupabaseServiceRoleClientMock).toHaveBeenCalled();
    expect(getUserRolesByEmailMock).toHaveBeenCalledWith('user@example.com', expect.any(Object));
    expect(getSigningJobMock).not.toHaveBeenCalled();
  });

  it('returns 403 for non-staff signing job list requests', async () => {
    const response = await jobListRoute.GET(
      new Request('https://example.com/api/admin/signing/jobs')
    );

    expect(response.status).toBe(403);
    expect(createSupabaseServiceRoleClientMock).toHaveBeenCalled();
    expect(getUserRolesByEmailMock).toHaveBeenCalledWith('user@example.com', expect.any(Object));
    expect(listSigningJobsMock).not.toHaveBeenCalled();
  });

  it('returns 403 for non-staff signing receipt requests', async () => {
    const response = await receiptRoute.GET(
      new Request('https://example.com/api/admin/signing/receipts/receipt-1'),
      { params: { id: 'receipt-1' } }
    );

    expect(response.status).toBe(403);
    expect(createSupabaseServiceRoleClientMock).toHaveBeenCalled();
    expect(getUserRolesByEmailMock).toHaveBeenCalledWith('user@example.com', expect.any(Object));
    expect(getSigningReceiptMock).not.toHaveBeenCalled();
  });
});

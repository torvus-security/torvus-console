import 'server-only';

import { createSupabaseServiceRoleClient } from '../supabase/admin';
import {
  SigningJobRecordSchema,
  SigningReceiptRecordSchema,
  type SigningJobRecord,
  type SigningReceiptRecord
} from '../../types/internal/signing';

export type SigningJob = {
  id: string;
  ownerId: string | null;
  status: string | null;
  createdAt: string;
  job: unknown;
};

export type SigningReceipt = {
  id: string;
  ownerId: string | null;
  createdAt: string;
  receipt: unknown;
};

export type SigningJobListOptions = {
  limit?: number;
  cursor?: string;
};

export type SigningJobListResult = {
  jobs: SigningJob[];
  nextCursor: string | null;
};

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit ?? Number.NaN)) {
    return 50;
  }

  const bounded = Math.max(1, Math.min(200, Math.floor(limit!)));
  return bounded;
}

function normaliseCursor(cursor: string | undefined): string | null {
  if (!cursor) {
    return null;
  }

  const parsed = new Date(cursor);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid signing job cursor. Expected ISO-8601 timestamp.');
  }

  return parsed.toISOString();
}

function normaliseTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid timestamp returned from signing RPC.');
  }
  return parsed.toISOString();
}

function toSigningJob(record: SigningJobRecord): SigningJob {
  return {
    id: record.id,
    ownerId: record.owner_id ?? null,
    status: record.status ?? null,
    createdAt: normaliseTimestamp(record.created_at),
    job: record.job ?? null
  };
}

function toSigningReceipt(record: SigningReceiptRecord): SigningReceipt {
  return {
    id: record.id,
    ownerId: record.owner_id ?? null,
    createdAt: normaliseTimestamp(record.created_at),
    receipt: record.receipt ?? null
  };
}

export async function getSigningJob(id: string): Promise<SigningJob | null> {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc('signing_job_get', { p_id: id });

  if (error) {
    throw new Error(`Failed to load signing job ${id}: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const record = SigningJobRecordSchema.parse(data);
  return toSigningJob(record);
}

export async function getSigningReceipt(id: string): Promise<SigningReceipt | null> {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc('signing_receipt_read', { p_id: id });

  if (error) {
    throw new Error(`Failed to load signing receipt ${id}: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const record = SigningReceiptRecordSchema.parse(data);
  return toSigningReceipt(record);
}

export async function listSigningJobs(
  options: SigningJobListOptions = {}
): Promise<SigningJobListResult> {
  const limit = clampLimit(options.limit);
  const cursor = normaliseCursor(options.cursor);

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc('signing_jobs_list', {
    p_limit: limit,
    p_after: cursor
  });

  if (error) {
    throw new Error(`Failed to list signing jobs: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  const jobs = rows.map((row) => toSigningJob(SigningJobRecordSchema.parse(row)));

  const nextCursor = jobs.length === limit ? jobs[jobs.length - 1]?.createdAt ?? null : null;

  return {
    jobs,
    nextCursor
  };
}

import { z } from 'zod';

export const SigningJobRecordSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid().nullable().optional(),
  job: z.unknown(),
  status: z.string().nullable().optional(),
  created_at: z.string()
});

export type SigningJobRecord = z.infer<typeof SigningJobRecordSchema>;

export const SigningReceiptRecordSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid().nullable().optional(),
  receipt: z.unknown(),
  created_at: z.string()
});

export type SigningReceiptRecord = z.infer<typeof SigningReceiptRecordSchema>;

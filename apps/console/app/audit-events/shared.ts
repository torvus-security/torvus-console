import { z } from 'zod';

export const FilterSchema = z.object({
  actor: z.string().trim().min(1).max(128).optional(),
  event: z.string().trim().min(1).max(128).optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1)
});

export type FilterValues = z.infer<typeof FilterSchema>;

export type AuditEventRow = {
  id: string;
  actor: string;
  event: string;
  created_at: string;
  object: string | null;
  metadata: Record<string, unknown> | null;
};

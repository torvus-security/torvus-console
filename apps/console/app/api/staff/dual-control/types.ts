export type DualControlRequestRow = {
  id: string;
  action_key: string;
  payload: Record<string, unknown> | null;
  correlation_id: string;
  requested_by: string;
  approved_by: string | null;
  status: 'requested' | 'approved' | 'executed' | 'rejected' | 'expired';
  approved_at: string | null;
  executed_at: string | null;
  requested_at: string;
  [key: string]: unknown;
};

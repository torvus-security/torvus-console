export const INVESTIGATION_STATUSES = ['open', 'triage', 'in_progress', 'closed'] as const;
export const INVESTIGATION_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

export type InvestigationStatus = (typeof INVESTIGATION_STATUSES)[number];
export type InvestigationSeverity = (typeof INVESTIGATION_SEVERITIES)[number];

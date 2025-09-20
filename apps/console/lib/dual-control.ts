type DualControlStatus = 'requested' | 'approved' | 'executed' | 'rejected' | 'expired';

export type DualControlRequest = {
  id: string;
  actionKey: string;
  payload: Record<string, unknown>;
  correlationId: string;
  requestedBy: string;
  approvedBy?: string | null;
  status: DualControlStatus;
  requestedAt: Date;
  approvedAt?: Date | null;
  executedAt?: Date | null;
};

export class DualControlStore {
  private readonly requestsById = new Map<string, DualControlRequest>();
  private readonly requestsByCorrelation = new Map<string, DualControlRequest>();

  constructor(private readonly uuid: () => string = globalThis.crypto?.randomUUID?.bind(globalThis.crypto) ?? (() => Math.random().toString(36).slice(2))) {}

  create(input: {
    actionKey: string;
    payload: Record<string, unknown>;
    requestedBy: string;
    correlationId: string;
  }): DualControlRequest {
    const cacheKey = this.buildCorrelationKey(input.actionKey, input.correlationId);
    const existing = this.requestsByCorrelation.get(cacheKey);
    if (existing) {
      return existing;
    }

    const id = this.uuid();
    const request: DualControlRequest = {
      id,
      actionKey: input.actionKey,
      payload: input.payload,
      correlationId: input.correlationId,
      requestedBy: input.requestedBy,
      status: 'requested',
      requestedAt: new Date()
    };

    this.requestsById.set(id, request);
    this.requestsByCorrelation.set(cacheKey, request);
    return request;
  }

  approve(id: string, approverId: string): DualControlRequest {
    const request = this.getRequired(id);
    if (request.requestedBy === approverId) {
      throw new Error('Dual-control approval requires a different staff member.');
    }
    if (request.status !== 'requested') {
      throw new Error(`Cannot approve request in status ${request.status}.`);
    }

    const updated: DualControlRequest = {
      ...request,
      approvedBy: approverId,
      status: 'approved',
      approvedAt: new Date()
    };
    this.requestsById.set(id, updated);
    this.requestsByCorrelation.set(this.buildCorrelationKey(request.actionKey, request.correlationId), updated);
    return updated;
  }

  execute(id: string, executorId: string): DualControlRequest {
    const request = this.getRequired(id);
    if (request.status === 'executed') {
      return request;
    }
    if (request.status !== 'approved') {
      throw new Error(`Cannot execute request in status ${request.status}.`);
    }
    if (!request.approvedBy) {
      throw new Error('Request must be approved before execution.');
    }
    if (request.approvedBy === executorId) {
      throw new Error('Executor must differ from approver to preserve dual-control.');
    }

    const cacheKey = this.buildCorrelationKey(request.actionKey, request.correlationId);
    const existing = this.requestsByCorrelation.get(cacheKey);
    if (existing?.status === 'executed') {
      return existing;
    }

    const updated: DualControlRequest = {
      ...request,
      status: 'executed',
      executedAt: new Date()
    };

    this.requestsById.set(id, updated);
    this.requestsByCorrelation.set(cacheKey, updated);
    return updated;
  }

  get(id: string) {
    return this.requestsById.get(id) ?? null;
  }

  private getRequired(id: string) {
    const request = this.requestsById.get(id);
    if (!request) {
      throw new Error(`Dual-control request ${id} not found.`);
    }
    return request;
  }

  private buildCorrelationKey(actionKey: string, correlationId: string) {
    return `${actionKey}:${correlationId}`;
  }
}

export function assertPermissionForAction(permission: string, allowed: string[]) {
  if (!allowed.includes(permission)) {
    throw new Error(`Permission ${permission} is not allowed for this action.`);
  }
}

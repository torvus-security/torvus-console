import { describe, it, expect } from 'vitest';
import { DualControlStore } from '../lib/dual-control';

describe('Dual-control workflow', () => {
  it('prevents approving own request', () => {
    const store = new DualControlStore(() => 'req-1');
    const request = store.create({
      actionKey: 'releases.execute',
      payload: { version: '2024.09.18' },
      requestedBy: 'user-1',
      correlationId: 'corr-1'
    });

    expect(() => store.approve(request.id, 'user-1')).toThrow(/requires a different staff member/);
  });

  it('executes idempotently for the same correlation id', () => {
    const store = new DualControlStore(() => 'req-2');
    const request = store.create({
      actionKey: 'policy.edit',
      payload: { policy: 'network' },
      requestedBy: 'user-2',
      correlationId: 'corr-2'
    });

    const approved = store.approve(request.id, 'user-3');
    const firstExecution = store.execute(approved.id, 'user-4');
    const secondExecution = store.execute(approved.id, 'user-5');

    expect(firstExecution.status).toBe('executed');
    expect(secondExecution.status).toBe('executed');
    expect(firstExecution.executedAt?.getTime()).toBe(secondExecution.executedAt?.getTime());
  });
});

import { describe, expect, it } from 'vitest';
import { formatBreadcrumb } from '../../lib/breadcrumbs';

describe('formatBreadcrumb', () => {
  it('returns overview for root paths', () => {
    expect(formatBreadcrumb('/')).toBe('Overview');
    expect(formatBreadcrumb('')).toBe('Overview');
    expect(formatBreadcrumb(undefined)).toBe('Overview');
  });

  it('formats single segments', () => {
    expect(formatBreadcrumb('/overview')).toBe('Overview');
    expect(formatBreadcrumb('/enroll-passkey')).toBe('Enroll Passkey');
  });

  it('formats nested segments with separators', () => {
    expect(formatBreadcrumb('/admin/secrets/approvals')).toBe('Admin / Secrets / Approvals');
    expect(formatBreadcrumb('/investigations/active-incidents')).toBe('Investigations / Active Incidents');
  });

  it('decodes encoded segments safely', () => {
    expect(formatBreadcrumb('/investigations/%E2%82%ACurope')).toBe('Investigations / €urope');
  });
});

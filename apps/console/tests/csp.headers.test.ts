import { describe, it, expect } from 'vitest';
import { buildContentSecurityPolicy } from '../lib/security';

describe('CSP header', () => {
  it('includes nonce and frame-ancestors none', () => {
    const csp = buildContentSecurityPolicy({
      nonce: 'abc123',
      environment: 'production',
      supabaseUrl: 'https://project.supabase.co',
      statuspageEmbedUrl: 'https://status.torvussecurity.com'
    });

    expect(csp).toContain("script-src 'self' 'nonce-abc123'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain('report-uri /api/csp-report');
    expect(csp).not.toContain("'unsafe-inline'");
  });

  it('relaxes inline/eval in development to support tooling', () => {
    const csp = buildContentSecurityPolicy({
      nonce: 'dev-nonce',
      environment: 'development'
    });

    expect(csp).toContain("'unsafe-inline'");
    expect(csp).toContain("'unsafe-eval'");
  });
});

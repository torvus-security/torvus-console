insert into public.audit_events (
  id,
  happened_at,
  actor_user_id,
  actor_email,
  actor_roles,
  action,
  target_type,
  target_id,
  resource,
  ip,
  user_agent,
  meta
) values
  ('11111111-1111-4111-8111-111111111111', now() - interval '2 days', null, 'system@torvussecurity.com', '{security_admin}', 'system_boot', 'service', 'console-core', 'console', null, 'torvus-batch/1.0', '{"status":"ok"}'),
  ('22222222-2222-4222-8222-222222222222', now() - interval '36 hours', null, 'admin@torvussecurity.com', '{security_admin}', 'user_login', 'user', 'admin@torvussecurity.com', 'console', '203.0.113.10', 'Mozilla/5.0 (Macintosh)', '{"mfa":"passkey"}'),
  ('33333333-3333-4333-8333-333333333333', now() - interval '30 hours', null, 'auditor@torvussecurity.com', '{auditor}', 'audit_view', 'page', 'audit', 'console', '198.51.100.24', 'Mozilla/5.0 (Windows NT 10.0)', '{"records":42}'),
  ('44444444-4444-4444-8444-444444444444', now() - interval '28 hours', null, 'operator@torvussecurity.com', '{operator}', 'investigation_create', 'investigation', 'INV-42', 'console.investigations', '198.51.100.99', 'Mozilla/5.0 (X11; Linux x86_64)', '{"priority":"high"}'),
  ('55555555-5555-4555-8555-555555555555', now() - interval '12 hours', null, 'admin@torvussecurity.com', '{security_admin}', 'staff_role_update', 'staff_role', 'security_admin', 'console.admin', '203.0.113.10', 'Mozilla/5.0 (Macintosh)', '{"added":"audit.export"}'),
  ('66666666-6666-4666-8666-666666666666', now() - interval '6 hours', null, 'auditor@torvussecurity.com', '{auditor}', 'audit_export', 'page', 'audit', 'console', '198.51.100.24', 'Mozilla/5.0 (Windows NT 10.0)', '{"format":"csv","count":120}'),
  ('77777777-7777-4777-8777-777777777777', now() - interval '4 hours', null, 'admin@torvussecurity.com', '{security_admin}', 'case_update', 'investigation', 'INV-42', 'console.investigations', '203.0.113.10', 'Mozilla/5.0 (Macintosh)', '{"status":"escalated"}'),
  ('88888888-8888-4888-8888-888888888888', now() - interval '1 hour', null, 'auditor@torvussecurity.com', '{auditor}', 'audit_view', 'page', 'audit', 'console', '198.51.100.24', 'Mozilla/5.0 (Windows NT 10.0)', '{"records":58}')
on conflict (id) do nothing;

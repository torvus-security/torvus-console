import { headers } from 'next/headers';
import { AccessDeniedNotice } from '../../../components/AccessDeniedNotice';

export default function AccessDeniedPage() {
  const headerBag = headers();
  const correlationId = headerBag.get('x-correlation-id');
  const denyReasons = headerBag.get('x-access-deny-reasons');

  const requestId = correlationId?.trim() ? correlationId.trim().slice(0, 8) : null;
  const reason = denyReasons
    ?.split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 0);
  const formattedReason = reason === 'missing_email' ? 'missing email' : reason;

  return <AccessDeniedNotice debugInfo={{ requestId, reason: formattedReason }} />;
}

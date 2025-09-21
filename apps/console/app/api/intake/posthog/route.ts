import { handleIntakeRequest } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return handleIntakeRequest('posthog', request);
}

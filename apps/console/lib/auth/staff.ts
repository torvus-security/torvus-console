const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;

if (!SUPABASE_URL?.startsWith("https://") || !SUPABASE_URL?.includes(".supabase.co")) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is invalid. Expect like https://XXXX.supabase.co");
}
if (!SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY.length < 40) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing or looks wrong.");
}

export { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL };

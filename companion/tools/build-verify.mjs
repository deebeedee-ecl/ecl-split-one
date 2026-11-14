process.env.NEXT_PUBLIC_SUPABASE_URL = "https://verification.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_verification";

await import("../build.cjs");

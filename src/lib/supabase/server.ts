import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side Supabase client following the Next.js quickstart.
// Uses public env vars and Next.js cookies to maintain the auth session.
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseKey) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY");

  // Next.js 15: cookies() is async in the official example
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component: safe to ignore if middleware
          // refreshes the session.
        }
      },
    },
  });
}

export async function getCurrentUserId(): Promise<string | undefined> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  return auth.user?.id;
}

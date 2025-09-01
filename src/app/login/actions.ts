"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

async function getBaseUrl() {
  const h = await headers();
  const fromHeader = h.get("x-forwarded-proto") && h.get("x-forwarded-host")
    ? `${h.get("x-forwarded-proto")}://${h.get("x-forwarded-host")}`
    : h.get("origin");
  return process.env.NEXT_PUBLIC_SITE_URL || fromHeader || "http://localhost:3000";
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const parsed = CredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    redirect("/error");
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    redirect("/error");
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const parsed = CredentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    redirect("/error");
  }

  const redirectTo = new URL("/auth/confirm", await getBaseUrl()).toString();
  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: {
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    redirect("/error");
  }

  // Ask user to check email. Keep UX simple by redirecting to home.
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient();
  const email = z.string().email().safeParse(formData.get("email"));
  if (!email.success) redirect("/error");
  const callback = new URL(
    "/auth/callback?next=" + encodeURIComponent("/auth/reset-password"),
    await getBaseUrl()
  ).toString();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: callback,
  });
  if (error) redirect("/error");
  redirect("/login");
}

export async function signinWithGithub() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: new URL("/auth/callback", await getBaseUrl()).toString(),
    },
  });
  if (error) redirect("/error");
  // Redirect user to the provider's auth page
  redirect(data.url);
}

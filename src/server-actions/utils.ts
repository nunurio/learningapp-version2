"use server";
import * as cache from "next/cache";
import * as supa from "@/lib/supabase/server";
import { dashboardUserTag } from "@/lib/db/dashboard";

type NextCacheNS = {
  revalidatePath?: (path: string, type?: "page" | "layout") => void;
  revalidateTag?: (tag: string) => void;
};
type SupaServerNS = {
  getCurrentUserId?: () => Promise<string | undefined>;
};

export async function safeRevalidatePath(path: string, type?: "page" | "layout") {
  try {
    const fn = (cache as NextCacheNS).revalidatePath;
    if (!fn) return;
    return type ? fn(path, type) : fn(path);
  } catch {}
}

export async function safeRevalidateTag(tag: string) {
  try {
    const fn = (cache as NextCacheNS).revalidateTag;
    if (!fn) return;
    fn(tag);
  } catch {}
}

export async function getCurrentUserIdSafe(): Promise<string | undefined> {
  try {
    const api = supa as SupaServerNS;
    if (typeof api.getCurrentUserId === "function") {
      return await api.getCurrentUserId();
    }
  } catch {}
  return undefined;
}

export async function revalidateDashboardForCurrentUser() {
  const uid = await getCurrentUserIdSafe();
  if (uid) safeRevalidateTag(dashboardUserTag(uid));
}

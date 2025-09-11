"use server";
import * as cache from "next/cache";
import * as supa from "@/lib/supabase/server";
import { dashboardUserTag } from "@/lib/db/dashboard";

export function safeRevalidatePath(path: string, type?: "page" | "layout") {
  try {
    const fn: any = (cache as any).revalidatePath;
    if (!fn) return;
    if (typeof type === "string") fn(path, type);
    else fn(path);
  } catch {}
}

export function safeRevalidateTag(tag: string) {
  try {
    // @ts-expect-error: guard for optional existence in tests
    cache.revalidateTag?.(tag);
  } catch {}
}

export async function getCurrentUserIdSafe(): Promise<string | undefined> {
  try {
    if ("getCurrentUserId" in supa && typeof (supa as any).getCurrentUserId === "function") {
      return await (supa as any).getCurrentUserId();
    }
  } catch {}
  return undefined;
}

export async function revalidateDashboardForCurrentUser() {
  const uid = await getCurrentUserIdSafe();
  if (uid) safeRevalidateTag(dashboardUserTag(uid));
}

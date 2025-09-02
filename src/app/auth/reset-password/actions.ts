"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const PasswordSchema = z
  .object({ password: z.string().min(6), confirm: z.string().min(6) })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] });

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  const parsed = PasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) redirect("/error");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) redirect("/error");
  redirect("/");
}


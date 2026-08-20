"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { categories } from "@/db/schema";

import { z } from "zod";

const createCategorySchema = z.object({
  name: z.string().trim().min(2),

  description: z.string().trim().optional(),
});

export async function createCategory(formData: FormData) {
  // Server actions are publicly reachable POST endpoints — always authorize.
  // This file's contract is throw-based (its form has no useActionState), so
  // an unauthorized call throws instead of returning a structured result.
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = createCategorySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid category.");
  }

  await db.insert(categories).values({
    name: parsed.data.name,
    description: parsed.data.description || null,
  });

  redirect("/categories");
}

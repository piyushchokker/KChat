import type { AppUser } from "@/types";

/**
 * Sync the current Supabase user to the users table.
 * Called after login to ensure user exists in our database.
 */
export async function syncUser(): Promise<AppUser> {
  const res = await fetch("/api/auth/sync", {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Sync failed" }));
    throw new Error(err.error ?? "Failed to sync user");
  }

  const data = await res.json();
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role,
    program: data.program ?? undefined,
    department: data.department ?? undefined,
    designation: data.designation ?? undefined,
  } as AppUser;
}

/**
 * Get the current user's profile from Supabase.
 */
export async function getUserProfile(): Promise<AppUser | null> {
  const res = await fetch("/api/user/profile");
  if (!res.ok) return null;

  const data = await res.json();
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role,
    program: data.program ?? undefined,
    department: data.department ?? undefined,
    designation: data.designation ?? undefined,
  } as AppUser;
}

/**
 * Update the current user's profile.
 */
export async function updateUserProfile(
  updates: Partial<{ name: string; program: string; department: string; designation: string }>
): Promise<AppUser> {
  const res = await fetch("/api/user/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Update failed" }));
    throw new Error(err.error ?? "Failed to update profile");
  }

  const data = await res.json();
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role,
    program: data.program ?? undefined,
    department: data.department ?? undefined,
    designation: data.designation ?? undefined,
  } as AppUser;
}


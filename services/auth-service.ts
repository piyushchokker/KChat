import type { AppUser } from "@/types";
import { apiClient } from "./api-client";

function mapToAppUser(data: any): AppUser {
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role,
    roll_number: data.roll_number ?? undefined,
    course_id: data.course_id ?? undefined,
    school_id: data.school_id ?? undefined,
    
    
    // Extract string representation from joins if they exist
    course: data.courses?.name ?? undefined,
    school: data.schools?.name ?? undefined,
    program: data.programs?.name ?? undefined,
    department: data.departments?.name ?? undefined,
    
  } as AppUser;
}

/**
 * Sync the current Supabase user to the users table.
 * Called after login to ensure user exists in our database.
 */
export async function syncUser(): Promise<AppUser> {
  const data = await apiClient.post<any>("/auth/sync", {});
  return mapToAppUser(data);
}

/**
 * Get the current user's profile from Supabase.
 */
export async function getUserProfile(): Promise<AppUser | null> {
  try {
    const data = await apiClient.get<any>("/user/profile");
    return mapToAppUser(data);
  } catch {
    return null;
  }
}

/**
 * Update the current user's profile.
 */
export async function updateUserProfile(
  updates: Partial<{ name: string; school_id: string; course_id: string; }>
): Promise<AppUser> {
  const data = await apiClient.patch<any>("/user/profile", updates);
  return mapToAppUser(data);
}

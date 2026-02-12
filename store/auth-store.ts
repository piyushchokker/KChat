"use client";

import { create } from "zustand";
import type { AppUser, UserRole } from "@/types";
import { syncUser, getUserProfile } from "@/services/auth-service";
import { createBrowserClient } from "@/lib/supabase";

interface AuthState {
  user: AppUser | null;
  selectedRole: UserRole | null;
  isLoading: boolean;
  isSynced: boolean;
  error: string | null;

  setRole: (role: UserRole) => void;
  syncWithSupabase: () => Promise<void>;
  loadProfile: () => Promise<void>;
  setUser: (user: AppUser | null) => void;
  clearError: () => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  selectedRole: null,
  isLoading: false,
  isSynced: false,
  error: null,

  setRole: (role) => set({ selectedRole: role, error: null }),

  syncWithSupabase: async () => {
    set({ isLoading: true, error: null });
    try {
      const user = await syncUser();
      set({ user, isLoading: false, isSynced: true });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Sync failed",
        isLoading: false,
      });
    }
  },

  loadProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      const user = await getUserProfile();
      set({ user, isLoading: false, isSynced: !!user });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load profile",
        isLoading: false,
      });
    }
  },

  setUser: (user) => set({ user }),

  clearError: () => set({ error: null }),

  signOut: async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    set({ user: null, isSynced: false, selectedRole: null });
  },
}));

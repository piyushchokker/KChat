import React from "react";
import { createAdminClient, createServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import RegistrarLayout from "@/components/layout/registrar-layout";
import LoadingLinkButton from "@/components/common/loading-link-button";
import CachedQueriesPanel, { type CachedQueryRow } from "@/components/forms/cached-queries-panel";

export default async function StudentQueriesPage() {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/registrar/login?error=unauthorized");
  }

  const normalizedEmail = (authUser.email ?? "").trim().toLowerCase();
  const admin = createAdminClient();

  const { data: byAuthId } = await admin
    .from("users")
    .select("id, auth_id, role, is_allowed")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  let appUser = byAuthId;

  // Recover auth_id drift for existing approved registrar accounts.
  if (!appUser && normalizedEmail) {
    const { data: byEmail } = await admin
      .from("users")
      .select("id, auth_id, role, is_allowed")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (byEmail) {
      appUser = byEmail;

      if (byEmail.auth_id !== authUser.id) {
        await admin.from("users").update({ auth_id: authUser.id }).eq("id", byEmail.id);
      }
    }
  }

  const isAuthorizedRegistrar =
    appUser?.role === "registrar" && appUser.is_allowed !== false;

  if (!isAuthorizedRegistrar) {
    redirect("/registrar/login?error=unauthorized");
  }

  const { data: cachedQueries } = await admin
    .from("cached_quries")
    .select(
      "id, query, answer, created_at, created_by, created_by_user:users!cached_quries_created_by_fkey(name, email)"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (cachedQueries ?? []) as unknown as CachedQueryRow[];

  return (
    <RegistrarLayout
      user={{
        name: authUser.user_metadata?.name || "Registrar",
        email: authUser.email ?? normalizedEmail,
        imageUrl: authUser.user_metadata?.imageUrl || undefined,
      }}
    >
      <div className="flex-1 p-6 sm:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Cached Queries</h1>
                <p className="mt-1 text-sm text-gray-500">
                  View cached Excel queries stored in Supabase (`cached_quries`) and export them.
                </p>
              </div>
              <LoadingLinkButton
                href="/registrar/dashboard"
                variant="secondary"
                className="h-10 border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Back to Dashboard
              </LoadingLinkButton>
            </div>

            <CachedQueriesPanel initialQueries={rows} />
          </div>
        </div>
      </div>
    </RegistrarLayout>
  );
}


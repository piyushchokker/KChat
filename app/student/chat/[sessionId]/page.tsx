import { createServerClient, createAdminClient } from "@/lib/supabase-server";
import { verifyStudentAccess } from "@/lib/student-auth";
import { redirect } from "next/navigation";
import StudentLayout from "@/components/layout/student-layout";
import ChatContainer from "@/components/chatbot/chat-container";

interface StudentChatSessionPageProps {
  params: Promise<{ sessionId: string }>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeSessionId(input: string): string {
  return input.trim().toLowerCase();
}

function isValidSessionId(sessionId: string): boolean {
  return UUID_PATTERN.test(sessionId);
}

export default async function StudentChatSessionPage(
  props: StudentChatSessionPageProps
) {
  const { sessionId } = await props.params;
  const normalizedSessionId = normalizeSessionId(sessionId);

  if (!isValidSessionId(normalizedSessionId)) {
    redirect("/student/chat");
  }

  const supabase = await createServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/student/login?error=auth_failed");
  }

  const access = await verifyStudentAccess(authUser);

  if (!access.ok) {
    if (access.reason === "not_allowed") {
      redirect("/student/banned");
    }

    redirect("/student/login?error=auth_failed");
  }

  // Sync user to Supabase on every chat load.
  const email = authUser.email ?? "";
  const meta = authUser.user_metadata ?? {};

  // Microsoft Azure: extract actual name (strip roll number from full_name).
  const rawName = meta.given_name || meta.name || meta.full_name || email;
  const name = rawName.replace(/\d+/g, "").trim();
  // Roll number = part before "@" in the email (e.g. 2501940081@krmu.edu.in).
  const rollNumber = email.includes("@") ? email.split("@")[0] : null;
  let imageUrl: string | undefined;
  let isBanned = false;

  try {
    const admin = createAdminClient();

    const { data: existingByAuth } = await admin
      .from("users")
      .select("id, auth_id, role, is_allowed, image_url, roll_number")
      .eq("auth_id", authUser.id)
      .maybeSingle();

    let existingUser = existingByAuth;
    if (!existingUser && email) {
      const { data: existingByEmail } = await admin
        .from("users")
        .select("id, auth_id, role, is_allowed, image_url, roll_number")
        .ilike("email", email)
        .maybeSingle();
      existingUser = existingByEmail;
    }

    if (existingUser?.is_allowed === false) {
      isBanned = true;
    }

    const nextRollNumber =
      existingUser?.role === "student"
        ? rollNumber
        : (existingUser?.roll_number ?? null);

    const syncPayload = {
      auth_id: authUser.id,
      email,
      name,
      roll_number: nextRollNumber,
    };

    let syncedProfile:
      | { image_url: string | null; is_allowed: boolean }
      | null = null;

    if (existingUser) {
      const { data, error: syncError } = await admin
        .from("users")
        .update(syncPayload)
        .eq("id", existingUser.id)
        .select("image_url, is_allowed")
        .single();

      if (syncError) {
        console.error("[Student Sync Error]", JSON.stringify(syncError, null, 2));
      } else {
        syncedProfile = data;
      }
    } else {
      const { data, error: syncError } = await admin
        .from("users")
        .insert({
          ...syncPayload,
          role: "student",
          is_allowed: true,
        })
        .select("image_url, is_allowed")
        .single();

      if (syncError) {
        console.error("[Student Sync Error]", JSON.stringify(syncError, null, 2));
      } else {
        syncedProfile = data;
      }
    }

    if (syncedProfile?.is_allowed === false) {
      isBanned = true;
    }

    imageUrl = syncedProfile?.image_url ?? existingUser?.image_url ?? undefined;

    // If no image stored yet, try fetching from Microsoft Graph.
    if (!imageUrl) {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const providerToken = session?.provider_token;
        if (providerToken) {
          const photoRes = await fetch(
            "https://graph.microsoft.com/v1.0/me/photo/$value",
            {
              headers: { Authorization: `Bearer ${providerToken}` },
            }
          );
          if (photoRes.ok) {
            const photoBuffer = Buffer.from(await photoRes.arrayBuffer());
            const contentType = photoRes.headers.get("content-type") || "image/jpeg";
            const ext = contentType.includes("png") ? "png" : "jpg";
            const storagePath = `${authUser.id}.${ext}`;
            await admin.storage
              .from("avatars")
              .upload(storagePath, photoBuffer, { contentType, upsert: true });
            const {
              data: { publicUrl },
            } = admin.storage.from("avatars").getPublicUrl(storagePath);
            imageUrl = `${publicUrl}?t=${Date.now()}`;
            await admin
              .from("users")
              .update({ image_url: imageUrl })
              .eq("auth_id", authUser.id);
          }
        }
      } catch (imgErr) {
        console.error("[Student Avatar Fetch]", imgErr);
      }
    }
  } catch (err) {
    console.error(
      "[Student Sync Exception]",
      err instanceof Error ? err.message : String(err)
    );
  }

  // Redirect banned students (must be outside try/catch because redirect() throws).
  if (isBanned) {
    redirect("/student/banned");
  }

  return (
    <StudentLayout
      user={{
        name: name || "Student",
        email,
        imageUrl,
      }}
    >
      <ChatContainer initialRetSessionId={normalizedSessionId} />
    </StudentLayout>
  );
}
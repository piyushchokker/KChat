import { NextResponse } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { schoolCode, courseCode } = body;

    if (!schoolCode || !courseCode) {
      return NextResponse.json({ error: "Missing school or course code" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Verify user exists and is a student
    const { data: existingUser } = await admin
      .from("users")
      .select("id, role")
      .eq("auth_id", authUser.id)
      .maybeSingle();

    if (!existingUser || existingUser.role !== "student") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Update user in DB
    const { error: updateError } = await admin
      .from("users")
      .update({
        school_code: schoolCode,
        course_code: courseCode,
      })
      .eq("id", existingUser.id);

    if (updateError) {
      console.error("[Student Onboarding API]", updateError);
      return NextResponse.json({ error: "Failed to update details" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Student Onboarding API Error]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, createServerClient } from "@/lib/supabase-server";
import {
  getAdminMetadataOptions,
  replaceAdminMetadataOptions,
} from "@/lib/document-metadata-options";
import type { AdminMetadataOptions } from "@/types/document-metadata-options";

const metadataLevelSchema = z.enum([
  "UG",
  "PG",
  "PhD",
  "General",
  "Integrated",
  "Diploma",
]);

const documentTypeSchema = z.object({
  key: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
});

const schoolSchema = z.object({
  key: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(160),
});

const courseSchema = z.object({
  schoolKey: z.string().trim().min(1).max(80),
  key: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(220),
  level: metadataLevelSchema,
  maxSemesters: z.number().int().min(0).max(20),
});

const adminMetadataOptionsSchema = z.object({
  documentTypes: z.array(documentTypeSchema),
  schools: z.array(schoolSchema),
  courses: z.array(courseSchema),
});

async function requireAdminUser() {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: actor } = await admin
    .from("users")
    .select("id, role, is_allowed")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (!actor || actor.role !== "admin" || actor.is_allowed === false) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { admin, actor };
}

function hasDuplicateKeys(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

function validatePayloadBusinessRules(payload: AdminMetadataOptions): string | null {
  if (hasDuplicateKeys(payload.documentTypes.map((item) => item.key))) {
    return "Document type keys must be unique.";
  }

  if (hasDuplicateKeys(payload.schools.map((item) => item.key))) {
    return "School keys must be unique.";
  }

  if (hasDuplicateKeys(payload.courses.map((item) => item.key))) {
    return "Course codes must be unique.";
  }

  const schoolKeys = new Set(payload.schools.map((school) => school.key));

  const hasUnknownSchoolReference = payload.courses.some(
    (course) => !schoolKeys.has(course.schoolKey)
  );

  if (hasUnknownSchoolReference) {
    return "Every course must belong to an existing school.";
  }

  return null;
}

/**
 * GET /api/admin/metadata-options
 *
 * Admin-only endpoint to fetch editable metadata options for registrar uploads.
 */
export async function GET() {
  const authResult = await requireAdminUser();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const result = await getAdminMetadataOptions(authResult.admin);
    return NextResponse.json(
      {
        options: result.options,
        source: result.source,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Failed to fetch admin metadata options:", error);
    return NextResponse.json(
      { error: "Failed to fetch metadata options" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/metadata-options
 *
 * Admin-only endpoint to replace metadata options used in registrar upload forms.
 */
export async function PUT(req: Request) {
  const authResult = await requireAdminUser();
  if (authResult.error) {
    return authResult.error;
  }

  const body = (await req.json().catch(() => null)) as unknown;
  const parsed = adminMetadataOptionsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  const payload = parsed.data;
  const businessRuleError = validatePayloadBusinessRules(payload);
  if (businessRuleError) {
    return NextResponse.json({ error: businessRuleError }, { status: 400 });
  }

  try {
    await replaceAdminMetadataOptions(authResult.admin, payload);

    await authResult.admin.from("audit_logs").insert({
      user_id: authResult.actor.id,
      action: "document_metadata_catalog_updated_by_admin",
      entity_type: "document_metadata_catalog",
      entity_id: null,
      metadata: {
        document_types: payload.documentTypes.length,
        schools: payload.schools.length,
        courses: payload.courses.length,
      },
    });

    const result = await getAdminMetadataOptions(authResult.admin);
    return NextResponse.json({ options: result.options, source: result.source });
  } catch (error) {
    console.error("Failed to update metadata options:", error);
    return NextResponse.json(
      { error: "Failed to update metadata options" },
      { status: 500 }
    );
  }
}

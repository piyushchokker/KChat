import { NextResponse } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase-server";
import { getFrontendMetadataOptions } from "@/lib/document-metadata-options";
import type { FrontendMetadataOptions } from "@/types/document-metadata-options";
import { z } from "zod";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".docx",
  ".txt",
  ".md",
  ".pptx",
  ".xlsx",
  ".csv",
  ".json",
  ".jsonl",
  ".html",
  ".xml",
  ".doc",
]);

const MIME_BY_EXTENSION: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ".pptx": [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  ".xlsx": [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  ".doc": ["application/msword"],
  ".txt": ["text/plain"],
  ".md": ["text/markdown", "text/plain"],
  ".csv": ["text/csv", "application/csv", "text/plain"],
  ".json": ["application/json", "text/plain"],
  ".jsonl": ["application/x-ndjson", "application/json", "text/plain"],
  ".html": ["text/html"],
  ".xml": ["application/xml", "text/xml", "text/plain"],
};

const JSON_TEXT_EXTENSIONS = new Set([".json", ".jsonl"]);
const FALLBACK_DEBUG_JSON_BYTES = 1024 * 1024;
const NO_EXPIRY_VALUE = "NOEXPIRY";
const NO_EXPIRY_DB_FROM = "1900-01-01";
const NO_EXPIRY_DB_TILL = "9999-12-31";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const effectiveDateSchema = z.union([
  z.string().regex(DATE_PATTERN),
  z.literal(NO_EXPIRY_VALUE),
]);

const metadataSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    documentType: z.string().trim().min(1).max(80),
    issuingAuthority: z.string().trim().min(2).max(120),
    effectiveFrom: effectiveDateSchema,
    effectiveTill: effectiveDateSchema,
    school: z.string().trim().max(120).optional().nullable(),
    course: z.string().trim().max(160).optional().nullable(),
    semester: z.string().trim().max(50).optional().nullable(),
    
  })
  .refine((m) => {
    const fromNoExpiry = m.effectiveFrom === NO_EXPIRY_VALUE;
    const tillNoExpiry = m.effectiveTill === NO_EXPIRY_VALUE;

    if (fromNoExpiry || tillNoExpiry) {
      return fromNoExpiry && tillNoExpiry;
    }

    return m.effectiveTill >= m.effectiveFrom;
  }, {
    message:
      "effective dates must both be NOEXPIRY or effectiveTill must be greater than or equal to effectiveFrom",
    path: ["effectiveTill"],
  });

type ParsedUploadMetadata = z.infer<typeof metadataSchema>;

function coerceEffectiveDates(metadata: ParsedUploadMetadata): {
  effectiveFrom: string;
  effectiveTill: string;
  isNoExpiry: boolean;
  dbEffectiveFrom: string | null;
  dbEffectiveTill: string | null;
} {
  if (metadata.effectiveFrom === NO_EXPIRY_VALUE) {
    return {
      effectiveFrom: NO_EXPIRY_DB_FROM,
      effectiveTill: NO_EXPIRY_DB_TILL,
      isNoExpiry: true,
      dbEffectiveFrom: null,
      dbEffectiveTill: null,
    };
  }

  return {
    effectiveFrom: metadata.effectiveFrom,
    effectiveTill: metadata.effectiveTill,
    isNoExpiry: false,
    dbEffectiveFrom: metadata.effectiveFrom,
    dbEffectiveTill: metadata.effectiveTill,
  };
}

function validateMetadataSelections(
  metadata: ParsedUploadMetadata,
  options: FrontendMetadataOptions
): string | null {
  const KRMU_GENERAL_SCHOOL_ID = "10";

  if (options.documentTypes.length === 0 && options.schools.length === 0) {
    return null;
  }

  const supportedDocumentTypes = new Set(
    options.documentTypes.map((docType) => docType.value)
  );

  if (
    supportedDocumentTypes.size > 0 &&
    !supportedDocumentTypes.has(metadata.documentType)
  ) {
    return "Invalid document type selected.";
  }

  const schoolId = metadata.school?.trim() ?? "";
  const courseId = metadata.course?.trim() ?? "";
  const semesterValue = metadata.semester?.trim() ?? "";

  if (!schoolId) {
    if (courseId || semesterValue) {
      return "Select a school before choosing course or semester.";
    }

    return null;
  }

  if (schoolId === KRMU_GENERAL_SCHOOL_ID) {
    if (courseId || semesterValue) {
      return "Course or semester cannot be set for KRMU general documents.";
    }

    return null;
  }

  const selectedSchool = options.schools.find((school) => school.id === schoolId);
  if (!selectedSchool) {
    return "Invalid school selected.";
  }

  if (!courseId) {
    if (semesterValue) {
      return "Semester cannot be set without selecting a course.";
    }

    return null;
  }

  const selectedCourse = selectedSchool.courses.find((course) => course.id === courseId);
  if (!selectedCourse) {
    return "Invalid course selected for the chosen school.";
  }

  if (!semesterValue) {
    return null;
  }

  const semesterAsNumber = Number.parseInt(semesterValue, 10);
  if (!Number.isFinite(semesterAsNumber) || semesterAsNumber < 1) {
    return "Semester must be a positive number.";
  }

  if (
    selectedCourse.maxSemesters > 0 &&
    semesterAsNumber > selectedCourse.maxSemesters
  ) {
    return `Semester cannot exceed ${selectedCourse.maxSemesters} for the selected course.`;
  }

  return null;
}

function getExtension(fileName: string): string {
  const normalized = fileName.trim().toLowerCase();
  const dot = normalized.lastIndexOf(".");
  return dot === -1 ? "" : normalized.slice(dot);
}

function startsWithBytes(buffer: Buffer, bytes: number[]): boolean {
  if (buffer.length < bytes.length) return false;
  return bytes.every((byte, index) => buffer[index] === byte);
}

function isPdf(buffer: Buffer): boolean {
  return startsWithBytes(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d]);
}

function isZip(buffer: Buffer): boolean {
  return (
    startsWithBytes(buffer, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWithBytes(buffer, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWithBytes(buffer, [0x50, 0x4b, 0x07, 0x08])
  );
}

function isLegacyDoc(buffer: Buffer): boolean {
  return startsWithBytes(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
}

function isLikelyText(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  return !sample.includes(0x00);
}

function validateMagicBytes(extension: string, fileBuffer: Buffer): boolean {
  if (extension === ".pdf") return isPdf(fileBuffer);
  if (extension === ".docx" || extension === ".pptx" || extension === ".xlsx") {
    return isZip(fileBuffer);
  }
  if (extension === ".doc") return isLegacyDoc(fileBuffer);
  return isLikelyText(fileBuffer);
}

function validateMimeType(extension: string, providedMime: string): boolean {
  if (!providedMime || providedMime === "application/octet-stream") {
    return true;
  }
  const allowed = MIME_BY_EXTENSION[extension] ?? [];
  return allowed.includes(providedMime.toLowerCase());
}

function isUploadDebugEnabled(req: Request): boolean {
  if (process.env.DEBUG_REGISTRAR_UPLOAD === "true") {
    return true;
  }

  return req.headers.get("x-debug-registrar-upload") === "1";
}

function resolveUploadDebugJsonByteLimit(): number {
  const parsed = Number.parseInt(
    process.env.DEBUG_REGISTRAR_UPLOAD_MAX_JSON_BYTES ?? "",
    10
  );

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return FALLBACK_DEBUG_JSON_BYTES;
  }

  return parsed;
}

async function logUploadDebugPayload({
  req,
  file,
  metadataStr,
  metadataRaw,
  extension,
}: {
  req: Request;
  file: File;
  metadataStr: string;
  metadataRaw: unknown;
  extension: string;
}) {
  const payloadSnapshot = {
    method: req.method,
    contentType: req.headers.get("content-type"),
    contentLength: req.headers.get("content-length"),
    file: {
      name: file.name,
      type: file.type || null,
      sizeBytes: file.size,
      extension,
      lastModified: file.lastModified,
      lastModifiedIso:
        file.lastModified > 0 ? new Date(file.lastModified).toISOString() : null,
    },
    metadataString: metadataStr,
    metadataParsed: metadataRaw,
  };

  console.log(
    "[Registrar Upload Debug] Server payload:\n" +
      JSON.stringify(payloadSnapshot, null, 2)
  );

  if (!JSON_TEXT_EXTENSIONS.has(extension)) {
    return;
  }

  const maxBytes = resolveUploadDebugJsonByteLimit();
  if (file.size > maxBytes) {
    console.log(
      `[Registrar Upload Debug] JSON file content skipped because file size ${file.size} exceeds DEBUG_REGISTRAR_UPLOAD_MAX_JSON_BYTES=${maxBytes}.`
    );
    return;
  }

  try {
    const fileText = await file.text();
    console.log("[Registrar Upload Debug] Server JSON file content:\n" + fileText);
  } catch (error) {
    console.error(
      "[Registrar Upload Debug] Failed to read JSON file content:",
      error
    );
  }
}

async function runMalwareScan(fileBuffer: Buffer, fileName: string) {
  const scanUrl = process.env.MALWARE_SCAN_URL;
  if (!scanUrl) {
    return { clean: true as const };
  }
  const scanBytes = Uint8Array.from(fileBuffer);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(scanUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-File-Name": encodeURIComponent(fileName),
      },
      body: scanBytes.buffer,
      signal: controller.signal,
    });

    if (!response.ok) {
      return { clean: false as const, reason: `Scan service returned ${response.status}` };
    }

    const payload = (await response.json().catch(() => null)) as
      | { clean?: boolean; reason?: string }
      | null;

    if (!payload || typeof payload.clean !== "boolean") {
      return { clean: false as const, reason: "Invalid scan response" };
    }

    if (!payload.clean) {
      return {
        clean: false as const,
        reason: payload.reason ?? "File rejected by malware scanner",
      };
    }

    return { clean: true as const };
  } catch {
    return { clean: false as const, reason: "Malware scan failed" };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * POST /api/documents/upload
 *
 * Upload a PDF document to Supabase Storage and save metadata to the database.
 */
export async function POST(req: Request) {
  const supabase = await createServerClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: user } = await admin
    .from("users")
    .select("id, role, is_allowed")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  if (!user || user.role !== "registrar" || user.is_allowed === false) {
    return NextResponse.json(
      { error: "Only registrars can upload documents" },
      { status: 403 }
    );
  }

  try {
    const debugUpload = isUploadDebugEnabled(req);
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const metadataStr = formData.get("metadata") as string | null;

    if (!file || !metadataStr) {
      return NextResponse.json(
        { error: "File and metadata are required" },
        { status: 400 }
      );
    }

    const extension = getExtension(file.name);

    let metadataRaw: unknown;
    try {
      metadataRaw = JSON.parse(metadataStr);
    } catch {
      if (debugUpload) {
        await logUploadDebugPayload({
          req,
          file,
          metadataStr,
          metadataRaw: { parseError: "Invalid metadata JSON" },
          extension,
        });
      }

      return NextResponse.json(
        { error: "Invalid metadata JSON" },
        { status: 400 }
      );
    }

    if (debugUpload) {
      await logUploadDebugPayload({
        req,
        file,
        metadataStr,
        metadataRaw,
        extension,
      });
    }

    const parsedMetadata = metadataSchema.safeParse(metadataRaw);
    if (!parsedMetadata.success) {
      return NextResponse.json(
        {
          error: "Invalid metadata",
          details: parsedMetadata.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const metadata = parsedMetadata.data;
    const metadataOptions = await getFrontendMetadataOptions(admin);
    const metadataSelectionError = validateMetadataSelections(
      metadata,
      metadataOptions
    );

    if (metadataSelectionError) {
      return NextResponse.json({ error: metadataSelectionError }, { status: 400 });
    }

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        { error: "File type not allowed" },
        { status: 400 }
      );
    }

    // Validate file size (50MB max)
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "File size exceeds 50MB limit" },
        { status: 400 }
      );
    }

    if (!validateMimeType(extension, file.type || "")) {
      return NextResponse.json(
        { error: "MIME type does not match file extension" },
        { status: 400 }
      );
    }

    // Read file once and run binary checks before upload.
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    if (!validateMagicBytes(extension, fileBuffer)) {
      return NextResponse.json(
        { error: "File signature validation failed" },
        { status: 400 }
      );
    }

    const scanResult = await runMalwareScan(fileBuffer, file.name);
    if (!scanResult.clean) {
      return NextResponse.json(
        { error: scanResult.reason ?? "File rejected by malware scan" },
        { status: 400 }
      );
    }

    // Create unique storage path
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    // Use school or 'general' for storage path, no libraryType
    const storagePath = `${metadata.school || "general"}/${timestamp}_${safeName}`;


    // Upload to Supabase Storage
    const { error: uploadError } = await admin.storage
      .from("documents")
      .upload(storagePath, fileBuffer, {
        contentType: file.type || undefined,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = admin.storage
      .from("documents")
      .getPublicUrl(storagePath);

    // Insert document record
    const effectiveDates = coerceEffectiveDates(metadata);

    const insertPayload: Record<string, unknown> = {
      title: metadata.title,
      file_name: file.name,
      file_url: urlData.publicUrl,
      file_size: file.size,
      storage_path: storagePath,
      type_code: metadata.documentType,
      school_code: metadata.school || null,
      course_code: metadata.course || null,
      semester: metadata.semester || null,
      effective_from: effectiveDates.dbEffectiveFrom,
      effective_till: effectiveDates.dbEffectiveTill,
      
      issuing_authority: metadata.issuingAuthority,
      uploaded_by: user.id,
    };

    let { data: doc, error: dbError } = await admin
      .from("documents")
      .insert(insertPayload as any)
      .select()
      .single();

    if (dbError) {
      // Cleanup uploaded file on DB error
      await admin.storage.from("documents").remove([storagePath]);
      console.error("Database insert error:", dbError);

      if (effectiveDates.isNoExpiry && dbError.code === "23502") {
        return NextResponse.json(
          {
            error:
              "Unable to store NULL effective dates for NOEXPIRY documents. Please ensure documents.effective_from and documents.effective_till allow NULL and no trigger/default rewrites NULL values.",
            db: {
              code: dbError.code ?? null,
              message: dbError.message ?? null,
              details: dbError.details ?? null,
              hint: dbError.hint ?? null,
            },
          },
          { status: 500 }
        );
      }

      if (dbError.code === "22007") {
        return NextResponse.json(
          { error: "Invalid effectiveFrom/effectiveTill date format." },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "Failed to save document metadata" },
        { status: 500 }
      );
    }

    if (!doc) {
      await admin.storage.from("documents").remove([storagePath]);
      return NextResponse.json(
        { error: "Failed to save document metadata" },
        { status: 500 }
      );
    }

    if (effectiveDates.isNoExpiry) {
      const { data: normalizedDoc, error: normalizeError } = await admin
        .from("documents")
        .update({ effective_from: null, effective_till: null } as any)
        .eq("id", doc.id)
        .select()
        .single();

      if (!normalizeError && normalizedDoc) {
        doc = normalizedDoc;
      } else if (normalizeError) {
        await admin.storage.from("documents").remove([storagePath]);
        await admin.from("documents").delete().eq("id", doc.id);
        return NextResponse.json(
          {
            error:
              "NOEXPIRY normalization failed while writing NULL effective dates. Please verify DB constraints/triggers on documents.effective_from and documents.effective_till.",
            db: {
              code: normalizeError.code ?? null,
              message: normalizeError.message ?? null,
              details: normalizeError.details ?? null,
              hint: normalizeError.hint ?? null,
            },
          },
          { status: 500 }
        );
      }
    }

    // Audit log
    await admin.from("audit_logs").insert({
      user_id: user.id,
      action: "document_uploaded",
      entity_type: "document",
      entity_id: doc.id,
      metadata: {
        title: metadata.title,
        file_name: file.name,
        type_code: metadata.documentType,
      },
    });

    return NextResponse.json({
      id: doc.id,
      file: null,
      metadata: {
        title: doc.title,
        type_id: doc.type_id,
        school_code: doc.school_code,
        course_code: doc.course_code,
        semester: doc.semester,
        effectiveFrom: effectiveDates.isNoExpiry ? NO_EXPIRY_VALUE : doc.effective_from,
        effectiveTill: effectiveDates.isNoExpiry ? NO_EXPIRY_VALUE : doc.effective_till,
        
        issuingAuthority: doc.issuing_authority,
      },
      uploadedAt: doc.created_at,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/documents/upload
 *
 * List all uploaded documents. Supports query params for filtering.
 */
export async function GET(req: Request) {
  const supabase = await createServerClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { searchParams } = new URL(req.url);

  const { data: currentUser } = await admin
    .from("users")
    .select("id, role, is_allowed")
    .eq("auth_id", authUser.id)
    .single();

  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (currentUser.is_allowed === false) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isPrivilegedUser =
    currentUser.role === "registrar" || currentUser.role === "admin";
  const studentSelect =
    "id, title, file_name, file_url, file_size, type_code, school_code, course_code, semester, effective_from, effective_till, issuing_authority, created_at, updated_at";
  const registrarSelect =
    `${studentSelect}, storage_path, uploaded_by, uploaded_by_user:users!documents_uploaded_by_fkey(name, email)`;
  const selectColumns = isPrivilegedUser ? registrarSelect : studentSelect;

  let query = admin
    .from("documents")
    .select(selectColumns, { count: "exact" })
    .order("created_at", { ascending: false });

  // Filters
  const docType = searchParams.get("type");
  if (docType) query = query.eq("type_code", docType);

  const library = searchParams.get("library");
  if (library) query = query.eq("library_type", library);

  const school = searchParams.get("school");
  if (school) query = query.eq("school_code", school);

  const visibility = searchParams.get("visibility");
  if (visibility) query = query.eq("visibility", visibility);

  const mineOnly = searchParams.get("mine") === "true";
  if (mineOnly && isPrivilegedUser) {
    query = query.eq("uploaded_by", currentUser.id);
  }

  const searchQuery = searchParams.get("q")?.trim() ?? "";
  if (searchQuery) {
    const safeQuery = searchQuery.replace(/[^a-zA-Z0-9\s._-]/g, " ").trim();
    if (safeQuery) {
      query = query.or(`title.ilike.%${safeQuery}%,file_name.ilike.%${safeQuery}%`);
    }
  }

  // removed status and year filters

  const fetchAll = searchParams.get("all") === "true";

  // Pagination
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  if (!fetchAll) {
    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Failed to fetch documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }

  type DocumentRow = Record<string, unknown> & { id: string };
  const rawDocuments = (data ?? []) as unknown[];

  const documentRows: DocumentRow[] = rawDocuments.filter(
    (doc): doc is DocumentRow =>
      typeof doc === "object" &&
      doc !== null &&
      "id" in doc &&
      typeof (doc as { id?: unknown }).id === "string"
  );

  let documentsWithJobStatus = documentRows.map((doc) => ({
    ...doc,
    file_job_status: null as string | null,
  }));

  const documentIds = documentsWithJobStatus
    .map((doc) => doc.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (documentIds.length > 0) {
    const { data: fileJobs, error: fileJobError } = await admin
      .from("file_job")
      .select("id, status")
      .in("id", documentIds);

    if (fileJobError) {
      console.error("Failed to fetch file_job statuses:", fileJobError);
    } else {
      const statusById = new Map(
        (fileJobs ?? []).map((row) => [row.id, row.status ?? null])
      );

      documentsWithJobStatus = documentsWithJobStatus.map((doc) => ({
        ...doc,
        file_job_status: statusById.get(doc.id) ?? null,
      }));
    }
  }

  return NextResponse.json({
    documents: documentsWithJobStatus,
    pagination: {
      page: fetchAll ? 1 : page,
      limit: fetchAll ? data?.length ?? 0 : limit,
      total: count,
    },
  });
}

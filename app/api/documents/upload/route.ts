import { NextResponse } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase-server";

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

  // Get internal user ID
  const { data: user } = await admin
    .from("users")
    .select("id, role")
    .eq("auth_id", authUser.id)
    .single();

  if (!user || user.role !== "registrar") {
    return NextResponse.json(
      { error: "Only registrars can upload documents" },
      { status: 403 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const metadataStr = formData.get("metadata") as string | null;

    if (!file || !metadataStr) {
      return NextResponse.json(
        { error: "File and metadata are required" },
        { status: 400 }
      );
    }

    const metadata = JSON.parse(metadataStr);


    // Validate file type by extension
    const allowedExtensions = [
      ".pdf", ".docx", ".txt", ".md", ".pptx", ".xlsx", ".csv", ".json", ".jsonl", ".html", ".xml", ".doc"
    ];
    const fileName = file.name.toLowerCase();
    const isAllowed = allowedExtensions.some(ext => fileName.endsWith(ext));
    if (!isAllowed) {
      return NextResponse.json(
        { error: "File type not allowed" },
        { status: 400 }
      );
    }

    // Validate file size (50MB max)
    if (file.size > 52428800) {
      return NextResponse.json(
        { error: "File size exceeds 50MB limit" },
        { status: 400 }
      );
    }

    // Create unique storage path
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    // Use school or 'general' for storage path, no libraryType
    const storagePath = `${metadata.school || "general"}/${timestamp}_${safeName}`;


    // Upload to Supabase Storage
    const fileBuffer = Buffer.from(await file.arrayBuffer());
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
    const { data: doc, error: dbError } = await admin
      .from("documents")
      .insert({
        title: metadata.title,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        storage_path: storagePath,
        document_type: metadata.documentType,
        applicable_to: metadata.applicableTo || [],
        academic_level: metadata.academicLevel || [],
        school: metadata.school || null,
        course: metadata.course || null,
        regulation: metadata.regulation || null,
        semester: metadata.semester || null,
        effective_from: metadata.effectiveFrom,
        effective_till: metadata.effectiveTill,
        keywords: metadata.keywords || [],
        student_intent_mapping: metadata.studentIntentMapping || null,
        issuing_authority: metadata.issuingAuthority,
        change_summary: metadata.changeSummary || null,
        academic_year: metadata.academicYear || null,
        uploaded_by: user.id,
        processing_status: "pending",
      })
      .select()
      .single();

    if (dbError) {
      // Cleanup uploaded file on DB error
      await admin.storage.from("documents").remove([storagePath]);
      console.error("Database insert error:", dbError);
      return NextResponse.json(
        { error: "Failed to save document metadata" },
        { status: 500 }
      );
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
        document_type: metadata.documentType,
      },
    });

    return NextResponse.json({
      id: doc.id,
      file: null,
      metadata: {
        title: doc.title,
        documentType: doc.document_type,
        applicableTo: doc.applicable_to,
        academicLevel: doc.academic_level,
        school: doc.school,
        course: doc.course,
        regulation: doc.regulation,
        semester: doc.semester,
        effectiveFrom: doc.effective_from,
        effectiveTill: doc.effective_till,
        keywords: doc.keywords,
        studentIntentMapping: doc.student_intent_mapping,
        issuingAuthority: doc.issuing_authority,
        changeSummary: doc.change_summary,
        academicYear: doc.academic_year,
      },
      uploadedAt: doc.created_at,
      status: doc.processing_status,
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

  let query = admin
    .from("documents")
    .select("*, uploaded_by_user:users!documents_uploaded_by_fkey(name, email)")
    .order("created_at", { ascending: false });

  // Filters
  const docType = searchParams.get("type");
  if (docType) query = query.eq("document_type", docType);

  const library = searchParams.get("library");
  if (library) query = query.eq("library_type", library);

  const school = searchParams.get("school");
  if (school) query = query.eq("school", school);

  const visibility = searchParams.get("visibility");
  if (visibility) query = query.eq("visibility", visibility);

  const status = searchParams.get("status");
  if (status) query = query.eq("processing_status", status);

  const year = searchParams.get("year");
  if (year) query = query.eq("academic_year", year);

  // Pagination
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Failed to fetch documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    documents: data,
    pagination: {
      page,
      limit,
      total: count,
    },
  });
}

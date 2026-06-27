import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "@/types/database";
import type {
  AdminMetadataOptions,
  FrontendMetadataOptions,
  MetadataOptionLevel,
} from "@/types/document-metadata-options";

type DocumentMetadataTypeRow = Database["public"]["Tables"]["document_types"]["Row"];
type DocumentMetadataSchoolRow =
  Database["public"]["Tables"]["schools"]["Row"];
type DocumentMetadataCourseRow =
  Database["public"]["Tables"]["courses"]["Row"];

const DEFAULT_MAX_SEMESTERS_BY_LEVEL: Record<MetadataOptionLevel, number> = {
  UG: 8,
  PG: 4,
  Diploma: 2,
  Integrated: 10,
  PhD: 6,
  General: 0,
};

const EMPTY_ADMIN_METADATA_OPTIONS: AdminMetadataOptions = {
  documentTypes: [],
  schools: [],
  courses: [],
};

function resolveMaxSemesters(level: MetadataOptionLevel, value?: number | null): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  return DEFAULT_MAX_SEMESTERS_BY_LEVEL[level] ?? 0;
}

function parseLevel(value: string | null): MetadataOptionLevel {
  switch (value) {
    case "UG":
    case "PG":
    case "PhD":
    case "General":
    case "Integrated":
    case "Diploma":
      return value;
    default:
      return "General";
  }
}

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  return (error as { code?: string }).code === "42P01";
}

function normalizeCode(value: string): string {
  return value.trim();
}

function normalizeName(value: string): string {
  return value.trim();
}

function buildFrontendMetadataOptionsFromAdmin(
  adminOptions: AdminMetadataOptions
): FrontendMetadataOptions {
  return {
    documentTypes: adminOptions.documentTypes.map((docType) => ({
      value: docType.key,
      label: docType.label,
    })),
    schools: adminOptions.schools.map((school) => ({
      id: school.key,
      name: school.label,
      courses: adminOptions.courses
        .filter((course) => course.schoolKey === school.key)
        .map((course) => ({
          id: course.key,
          name: course.label,
          level: course.level,
          maxSemesters: resolveMaxSemesters(course.level, course.maxSemesters),
        })),
    })),
  };
}

function rowsToAdminMetadataOptions(
  metadataTypes: DocumentMetadataTypeRow[],
  metadataSchools: DocumentMetadataSchoolRow[],
  metadataCourses: DocumentMetadataCourseRow[]
): AdminMetadataOptions {
  const schoolCodeById = new Map(
    metadataSchools.map((school) => [school.code, school.code])
  );

  return {
    documentTypes: metadataTypes.map((row) => ({
      key: row.code,
      label: row.name,
    })),
    schools: metadataSchools.map((row) => ({
      key: row.code,
      label: row.name,
    })),
    courses: metadataCourses
      .map((row) => {
        const schoolCode = schoolCodeById.get(row.school_code);
        if (!schoolCode) {
          return null;
        }

        return {
          schoolKey: schoolCode,
          key: row.code,
          label: row.name,
          level: parseLevel(row.academic_level),
          maxSemesters: resolveMaxSemesters(
            parseLevel(row.academic_level),
            row.max_semesters
          ),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null),
  };
}

async function listMetadataCatalogRows(
  admin: SupabaseClient<Database>
): Promise<
  | {
      metadataTypes: DocumentMetadataTypeRow[];
      metadataSchools: DocumentMetadataSchoolRow[];
      metadataCourses: DocumentMetadataCourseRow[];
    }
  | null
> {
  const [typesResult, schoolsResult, coursesResult] = await Promise.all([
    admin
      .from("document_types")
      .select("code, code, name, created_at, updated_at")
      .order("created_at", { ascending: false }),
    admin
      .from("schools")
      .select("code, code, name, created_at, updated_at")
      .order("created_at", { ascending: false }),
    admin
      .from("courses")
      .select(
        "code, school_code, name, academic_level, max_semesters, created_at, updated_at"
      )
      .order("created_at", { ascending: false }),
  ]);

  const possibleErrors = [typesResult.error, schoolsResult.error, coursesResult.error].filter(
    (error): error is NonNullable<typeof error> => Boolean(error)
  );

  if (possibleErrors.length > 0) {
    if (possibleErrors.some((error) => isMissingRelationError(error))) {
      return null;
    }

    throw possibleErrors[0];
  }

  return {
    metadataTypes: (typesResult.data ?? []) as DocumentMetadataTypeRow[],
    metadataSchools: (schoolsResult.data ?? []) as DocumentMetadataSchoolRow[],
    metadataCourses: (coursesResult.data ?? []) as DocumentMetadataCourseRow[],
  };
}

export async function replaceAdminMetadataOptions(
  admin: SupabaseClient<Database>,
  options: AdminMetadataOptions
): Promise<void> {
  const metadataTypeRows: TablesInsert<"document_types">[] =
    options.documentTypes.map((item) => ({
      code: normalizeCode(item.key),
      name: normalizeName(item.label),
    }));

  const metadataSchoolRows: TablesInsert<"schools">[] =
    options.schools.map((item) => ({
      code: normalizeCode(item.key),
      name: normalizeName(item.label),
    }));

  if (metadataTypeRows.length > 0) {
    const { error: upsertTypesError } = await admin
      .from("document_types")
      .upsert(metadataTypeRows, { onConflict: "code" });

    if (upsertTypesError) {
      throw upsertTypesError;
    }
  }

  const { data: currentTypes, error: currentTypesError } = await admin
    .from("document_types")
    .select("code, code");

  if (currentTypesError) {
    throw currentTypesError;
  }

  const typeCodes = new Set(metadataTypeRows.map((row) => row.code));
  const typeIdsToDelete = (currentTypes ?? [])
    .filter((row) => !typeCodes.has(row.code))
    .map((row) => row.code);

  if (typeIdsToDelete.length > 0) {
    const { error: deleteTypesError } = await admin
      .from("document_types")
      .delete()
      .in("code", typeIdsToDelete);

    if (deleteTypesError) {
      throw deleteTypesError;
    }
  }

  if (metadataSchoolRows.length > 0) {
    const { error: upsertSchoolsError } = await admin
      .from("schools")
      .upsert(metadataSchoolRows, { onConflict: "code" });

    if (upsertSchoolsError) {
      throw upsertSchoolsError;
    }
  }

  const { data: currentSchools, error: currentSchoolsError } = await admin
    .from("schools")
    .select("code, code");

  if (currentSchoolsError) {
    throw currentSchoolsError;
  }

  const schoolCodes = new Set(metadataSchoolRows.map((row) => row.code));
  const schoolIdsToDelete = (currentSchools ?? [])
    .filter((row) => !schoolCodes.has(row.code))
    .map((row) => row.code);

  if (schoolIdsToDelete.length > 0) {
    const { error: deleteSchoolsError } = await admin
      .from("schools")
      .delete()
      .in("code", schoolIdsToDelete);

    if (deleteSchoolsError) {
      throw deleteSchoolsError;
    }
  }

  const { data: persistedSchools, error: persistedSchoolsError } = await admin
    .from("schools")
    .select("code, code");

  if (persistedSchoolsError) {
    throw persistedSchoolsError;
  }

  const schoolIdByCode = new Map(
    (persistedSchools ?? []).map((school) => [school.code, school.code])
  );

  const metadataCourseRows: TablesInsert<"courses">[] =
    options.courses.map((item) => {
      const schoolCode = normalizeCode(item.schoolKey);
      const schoolId = schoolIdByCode.get(schoolCode);

      if (!schoolId) {
        throw new Error(`Unknown school code in course payload: ${schoolCode}`);
      }

      return {
        school_code: schoolId,
        code: normalizeCode(item.key),
        name: normalizeName(item.label),
        academic_level: item.level,
        max_semesters: resolveMaxSemesters(item.level, item.maxSemesters),
      };
    });

  if (metadataCourseRows.length > 0) {
    const { error: upsertCoursesError } = await admin
      .from("courses")
      .upsert(metadataCourseRows, { onConflict: "code" });

    if (upsertCoursesError) {
      throw upsertCoursesError;
    }
  }

  const { data: currentCourses, error: currentCoursesError } = await admin
    .from("courses")
    .select("code, school_code");

  if (currentCoursesError) {
    throw currentCoursesError;
  }

  const courseKeys = new Set(
    metadataCourseRows.map((row) => `${row.school_code}:${row.code}`)
  );
  const courseIdsToDelete = (currentCourses ?? [])
    .filter((row) => !courseKeys.has(`${row.school_code}:${row.code}`))
    .map((row) => row.code);

  if (courseIdsToDelete.length > 0) {
    const { error: deleteCoursesError } = await admin
      .from("courses")
      .delete()
      .in("code", courseIdsToDelete);

    if (deleteCoursesError) {
      throw deleteCoursesError;
    }
  }
}

export async function getAdminMetadataOptions(
  admin: SupabaseClient<Database>
): Promise<{ options: AdminMetadataOptions; source: "database" | "fallback" }> {
  const catalogRows = await listMetadataCatalogRows(admin);

  if (
    catalogRows === null ||
    (catalogRows.metadataTypes.length === 0 &&
      catalogRows.metadataSchools.length === 0 &&
      catalogRows.metadataCourses.length === 0)
  ) {
    return {
      options: EMPTY_ADMIN_METADATA_OPTIONS,
      source: "fallback",
    };
  }

  return {
    options: rowsToAdminMetadataOptions(
      catalogRows.metadataTypes,
      catalogRows.metadataSchools,
      catalogRows.metadataCourses
    ),
    source: "database",
  };
}

export async function getFrontendMetadataOptions(
  admin: SupabaseClient<Database>
): Promise<FrontendMetadataOptions> {
  const { options } = await getAdminMetadataOptions(admin);
  return buildFrontendMetadataOptionsFromAdmin(options);
}

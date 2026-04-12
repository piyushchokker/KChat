import { DOCUMENT_TYPES, SCHOOLS } from "@/utils/constants";
import type {
  AdminMetadataOptions,
  FrontendMetadataOptions,
  MetadataOptionLevel,
} from "@/types/document-metadata-options";

export const DEFAULT_MAX_SEMESTERS_BY_LEVEL: Record<MetadataOptionLevel, number> = {
  UG: 8,
  PG: 4,
  Diploma: 2,
  Integrated: 10,
  PhD: 6,
  General: 0,
};

export function resolveMaxSemesters(level: MetadataOptionLevel, value?: number | null): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  return DEFAULT_MAX_SEMESTERS_BY_LEVEL[level] ?? 0;
}

export function buildFallbackAdminMetadataOptions(): AdminMetadataOptions {
  return {
    documentTypes: DOCUMENT_TYPES.map((docType) => ({
      key: docType.value,
      label: docType.label,
    })),
    schools: SCHOOLS.map((school) => ({
      key: school.id,
      label: school.name,
    })),
    courses: SCHOOLS.flatMap((school) =>
      school.courses.map((course) => ({
        schoolKey: school.id,
        key: course.id,
        label: course.name,
        level: course.level,
        maxSemesters: resolveMaxSemesters(course.level, course.maxSemesters),
      }))
    ),
  };
}

export function buildFrontendMetadataOptionsFromAdmin(
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

export function buildFallbackFrontendMetadataOptions(): FrontendMetadataOptions {
  return buildFrontendMetadataOptionsFromAdmin(buildFallbackAdminMetadataOptions());
}

import type { AcademicLevel } from "@/types";

export type MetadataOptionLevel = AcademicLevel;

export interface FrontendDocumentTypeOption {
  value: string;
  label: string;
}

export interface FrontendCourseOption {
  id: string;
  name: string;
  level: MetadataOptionLevel;
  maxSemesters: number;
}

export interface FrontendSchoolOption {
  id: string;
  name: string;
  courses: FrontendCourseOption[];
}

export interface FrontendMetadataOptions {
  documentTypes: FrontendDocumentTypeOption[];
  schools: FrontendSchoolOption[];
}

export interface AdminDocumentTypeOption {
  key: string;
  label: string;
}

export interface AdminSchoolOption {
  key: string;
  label: string;
}

export interface AdminCourseOption {
  schoolKey: string;
  key: string;
  label: string;
  level: MetadataOptionLevel;
  maxSemesters: number;
}

export interface AdminMetadataOptions {
  documentTypes: AdminDocumentTypeOption[];
  schools: AdminSchoolOption[];
  courses: AdminCourseOption[];
}

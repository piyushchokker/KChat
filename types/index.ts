// ============================================================
// Types for K.R. Mangalam University Registrar Portal (KChat)
// ============================================================

// ---------- Auth ----------
export type UserRole = "student" | "registrar";

export interface StudentUser {
  id: string;
  name: string;
  email: string;
  role: "student";
  roll_number?: string;
  program?: string;
  department?: string;
}

export interface RegistrarUser {
  id: string;
  name: string;
  email: string;
  role: "registrar";
  designation?: string;
}

export type AppUser = StudentUser | RegistrarUser;

export interface LoginCredentials {
  email: string;
  password: string;
  role: UserRole;
}

// ---------- Chat ----------
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface ChatRequest {
  student_id: string;
  query: string;
}

export interface ChatResponse {
  answer: string;
  sources?: DocumentSource[];
  confidence?: number;
}

export interface DocumentSource {
  title: string;
  type: string;
  relevance: number;
}

// ---------- Documents ----------
export type DocumentType =
  | "policy"
  | "procedure"
  | "notice"
  | "circular"
  | "guideline"
  | "form"
  | "other";

export type LibraryType = "general" | "course-specific";

export type Visibility = "public" | "internal" | "archived";

export type AcademicLevel = "UG" | "PG" | "PhD" | "General" | "Integrated" | "Diploma";

export type ApplicableTo =
  | "current-students"
  | "alumni"
  | "faculty"
  | "all";

export interface DocumentMetadata {
  title: string;
  documentType: DocumentType;
  libraryType: LibraryType;

  // General Registrar Library fields
  applicableTo?: ApplicableTo[];
  academicLevel?: AcademicLevel[];

  // Course-Specific Library fields
  school?: string;
  course?: string;
  regulation?: string;
  semester?: string;

  // Common controls
  effectiveFrom: string;
  effectiveTill: string;
  visibility: Visibility;
  allowAiUsage: boolean;
  keywords: string[];
  studentIntentMapping?: string;
  issuingAuthority: string;
  version: string;
  changeSummary?: string;
  academicYear?: string;
}

export interface UploadedDocument {
  id: string;
  file: File | null;
  metadata: DocumentMetadata;
  uploadedAt: Date;
  status: "pending" | "processing" | "processed" | "failed";
}

export interface FileProcessingStatus {
  id: string;
  fileName: string;
  status: "uploading" | "processing" | "completed" | "failed";
  progress: number;
  message?: string;
}

// ---------- Schools / Courses ----------
export interface School {
  id: string;
  name: string;
  courses: Course[];
}

export interface Course {
  id: string;
  name: string;
  level: AcademicLevel;
}

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

type AdminClient = SupabaseClient<Database>;
type DbTableName = keyof Database["public"]["Tables"];

export type StudentDetailsRecord = {
  sourceTable: string;
  raw: Record<string, unknown>;
  rollNumber: string | null;
  studentName: string | null;
  studentEmail: string | null;
  course: string | null;
  school: string | null;
  department: string | null;
};

const DEFAULT_STUDENT_DETAIL_TABLES = ["student_details", "student_detail"];
const ROLL_NUMBER_COLUMNS = [
  "roll_number",
  "roll_no",
  "roll no",
  "rollno",
  "enrollment_no",
  "registration_no",
  "student_roll_number",
];

const NAME_COLUMNS = ["student_name", "student name", "name", "full_name"];
const EMAIL_COLUMNS = ["student_email", "email"];
const COURSE_COLUMNS = [
  "course",
  "course_name",
  "program",
  "programme",
  "student_course",
  "branch",
  "degree",
];
const SCHOOL_COLUMNS = ["school", "school_name", "faculty", "faculty_name"];
const DEPARTMENT_COLUMNS = ["department", "department_name", "dept"];

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getCaseInsensitiveValue(
  record: Record<string, unknown>,
  preferredKeys: string[]
): string | null {
  const keys = Object.keys(record);

  for (const preferredKey of preferredKeys) {
    const normalizedPreferredKey = normalizeKey(preferredKey);
    const foundKey = keys.find(
      (key) => normalizeKey(key) === normalizedPreferredKey
    );

    if (!foundKey) continue;

    const value = normalizeText(record[foundKey]);
    if (value) return value;
  }

  return null;
}

function getStudentDetailTables(): string[] {
  const env = process.env.STUDENT_DETAILS_TABLES;
  const parsed = (env ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : DEFAULT_STUDENT_DETAIL_TABLES;
}

function isTransientSupabaseError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("522") ||
    normalized.includes("timed out") ||
    normalized.includes("timeout") ||
    normalized.includes("<!doctype html") ||
    normalized.includes("<html")
  );
}

async function waitMs(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function extractRollNumberFromEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) {
    return null;
  }

  const roll = normalized.split("@")[0]?.trim() ?? "";
  return roll.length > 0 ? roll : null;
}

async function findStudentRecordByRoll(
  admin: AdminClient,
  rollNumber: string
): Promise<StudentDetailsRecord | null> {
  const normalizedRoll = rollNumber.trim();
  if (!normalizedRoll) {
    return null;
  }

  const tables = getStudentDetailTables();

  for (const tableName of tables) {
    for (const columnName of ROLL_NUMBER_COLUMNS) {
      const { data, error } = await admin
        // `STUDENT_DETAILS_TABLES` is configurable across deployments; cast to keep typed client usable.
        .from(tableName as unknown as DbTableName)
        .select("*")
        .eq(columnName, normalizedRoll)
        .limit(1)
        .maybeSingle();

      if (error) {
        // Keep trying other column/table combinations. Missing columns and tables are expected across environments.
        continue;
      }

      if (!data || typeof data !== "object") {
        continue;
      }

      const raw = data as Record<string, unknown>;
      const resolvedRoll =
        getCaseInsensitiveValue(raw, ROLL_NUMBER_COLUMNS) ?? normalizedRoll;

      return {
        sourceTable: tableName,
        raw,
        rollNumber: resolvedRoll,
        studentName: getCaseInsensitiveValue(raw, NAME_COLUMNS),
        studentEmail: getCaseInsensitiveValue(raw, EMAIL_COLUMNS),
        course: getCaseInsensitiveValue(raw, COURSE_COLUMNS),
        school: getCaseInsensitiveValue(raw, SCHOOL_COLUMNS),
        department: getCaseInsensitiveValue(raw, DEPARTMENT_COLUMNS),
      };
    }
  }

  return null;
}

export async function resolveStudentDetailsByEmail(
  admin: AdminClient,
  email: string,
  explicitRollNumber?: string | null
): Promise<StudentDetailsRecord | null> {
  const rollNumber =
    normalizeText(explicitRollNumber) ?? extractRollNumberFromEmail(email);

  if (!rollNumber) {
    return null;
  }

  return findStudentRecordByRoll(admin, rollNumber);
}

export async function upsertStudentProfileCache(
  admin: AdminClient,
  args: {
    userId: string;
    authId: string;
    fallbackEmail: string;
    fallbackName: string;
    details: StudentDetailsRecord | null;
    fallbackRollNumber?: string | null;
  }
): Promise<void> {
  const fallbackRoll = normalizeText(args.fallbackRollNumber);
  const resolvedRoll = args.details?.rollNumber ?? fallbackRoll;

  if (!resolvedRoll) {
    return;
  }

  const nowIso = new Date().toISOString();

  const payload = {
    user_id: args.userId,
    auth_id: args.authId,
    roll_number: resolvedRoll,
    student_name: args.details?.studentName ?? args.fallbackName,
    student_email: args.details?.studentEmail ?? args.fallbackEmail,
    course: args.details?.course ?? null,
    school: args.details?.school ?? null,
    department: args.details?.department ?? null,
    raw_details: (args.details?.raw ?? {}) as Json,
    synced_at: nowIso,
    updated_at: nowIso,
  };

  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const { error } = await admin
      .from("student_profile_cache")
      .upsert(payload, { onConflict: "user_id" });

    if (!error) {
      return;
    }

    if (attempt < maxRetries && isTransientSupabaseError(error.message)) {
      await waitMs(250 * (attempt + 1));
      continue;
    }

    console.error("Failed to upsert student_profile_cache:", error.message);
    return;
  }
}

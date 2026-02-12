export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isUniversityEmail(email: string): boolean {
  return email.endsWith("@krmangalam.edu.in");
}

export function isNotEmpty(value: string): boolean {
  return value.trim().length > 0;
}

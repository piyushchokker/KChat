"use client";

import { useState } from "react";
import { useDocumentMetadataOptions } from "@/lib/use-document-metadata-options";
import Button from "@/components/common/button";

export default function StudentOnboardingModal() {
  const { options, isLoading, error } = useDocumentMetadataOptions();
  const [selectedSchool, setSelectedSchool] = useState<string>("");
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const filteredSchools = options.schools.filter(school => school.id !== "10");
  const activeSchool = filteredSchools.find((s) => s.id === selectedSchool);
  const availableCourses = activeSchool?.courses ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchool || !selectedCourse) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/student/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolCode: selectedSchool,
          courseCode: selectedCourse,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save details");
      }

      window.location.reload();
    } catch (err: any) {
      setSubmitError(err.message || "An unexpected error occurred");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 sm:p-8 shadow-xl border border-gray-200 dark:border-gray-700">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome to KChat!</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Before you can start chatting, please tell us which school and course you belong to.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {submitError && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200">
              School
            </label>
            <select
              value={selectedSchool}
              onChange={(e) => {
                setSelectedSchool(e.target.value);
                setSelectedCourse(""); // Reset course when school changes
              }}
              disabled={isLoading || isSubmitting}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400"
              required
            >
              <option value="">Select your school...</option>
              {filteredSchools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-200">
              Course
            </label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              disabled={!selectedSchool || isLoading || isSubmitting}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-400"
              required
            >
              <option value="">
                {selectedSchool ? "Select your course..." : "Select a school first..."}
              </option>
              {availableCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>

          <Button
            type="submit"
            disabled={!selectedSchool || !selectedCourse || isLoading || isSubmitting}
            isLoading={isSubmitting}
            className="mt-6 w-full"
            size="lg"
          >
            Start Chatting
          </Button>
        </form>
      </div>
    </div>
  );
}

"use client";

interface SuggestedQuestionsProps {
  questions: string[];
  onSelect: (question: string) => void;
}

export default function SuggestedQuestions({
  questions,
  onSelect,
}: SuggestedQuestionsProps) {
  return (
    <div className="space-y-2">
      <p className="text-center text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-zinc-500">
        Try asking
      </p>
      <div className="space-y-2">
        {questions.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onSelect(q)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-700 transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-blue-400/40 dark:hover:bg-blue-900/30 dark:hover:text-blue-100"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

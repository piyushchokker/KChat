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
      <p className="text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
        Try asking
      </p>
      <div className="space-y-2">
        {questions.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onSelect(q)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-700 transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 hover:shadow-sm"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, forwardRef, useImperativeHandle } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export interface ChatInputRef {
  focus: () => void;
}

const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(
  ({ onSend, disabled }, ref) => {
    const [value, setValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const isSending = Boolean(disabled);

    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef.current?.focus();
      },
    }));

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = value.trim();
      if (!trimmed || disabled) return;
      onSend(trimmed);
      setValue("");
      inputRef.current?.focus();
    };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type your message here..."
        disabled={disabled}
        className="flex-1 border-none bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:opacity-50 dark:text-zinc-100 dark:placeholder:text-zinc-500"
      />
      <button
        type="submit"
        disabled={!value.trim() || disabled}
        aria-busy={isSending || undefined}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-800 text-white transition-colors hover:bg-blue-900 disabled:opacity-40 dark:bg-blue-900/70 dark:hover:bg-blue-800/75"
      >
        {isSending ? (
          <span
            className="h-4 w-4 rounded-full border-2 border-white/35 border-t-white animate-spin"
            aria-hidden
          />
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        )}
      </button>
    </form>
  );
});

ChatInput.displayName = "ChatInput";

export default ChatInput;

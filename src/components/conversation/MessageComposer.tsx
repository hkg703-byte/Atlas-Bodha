"use client";

import { FormEvent, KeyboardEvent, useState } from "react";

export function MessageComposer() {
  const [message, setMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      return;
    }

    console.log("Atlas message:", trimmedMessage);

    setMessage("");
  }

  // Enter sends; Shift+Enter adds a new line. Ignore Enter while an IME is composing.
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-3 border bg-white p-3"
      style={{
        borderColor: "var(--atlas-color-border)",
        borderRadius: "var(--atlas-radius-medium)",
      }}
    >
      <label htmlFor="atlas-message" className="sr-only">
        Message Atlas
      </label>

      <textarea
        id="atlas-message"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={handleKeyDown}
        enterKeyHint="send"
        autoFocus
        placeholder="Bring what matters to you..."
        rows={1}
        className="min-h-12 flex-1 border-0 bg-transparent p-3 outline-none"
        style={{
          color: "var(--atlas-color-text-primary)",
        }}
      />

      <button
        type="submit"
        disabled={!message.trim()}
        className="min-h-11 rounded-lg px-5 text-white transition-opacity disabled:cursor-default disabled:opacity-40"
        style={{
          background: "var(--atlas-color-accent)",
        }}
      >
        Send
      </button>
    </form>
  );
}

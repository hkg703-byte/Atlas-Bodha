"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Memory = {
  id: string;
  content: string;
  origin: "person_request" | "atlas_suggestion";
  confidence: "stated" | "inferred";
  created_at: string;
  updated_at: string;
};

type MemoryResponse = {
  consent: boolean | null;
  memories: Memory[];
};

async function memoryRequest(body?: object): Promise<MemoryResponse> {
  const response = await fetch("/api/v1/memory", body ? {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  } : undefined);
  if (!response.ok) throw new Error("Memory settings are temporarily unavailable.");
  if (!body) return response.json() as Promise<MemoryResponse>;

  const refreshed = await fetch("/api/v1/memory");
  if (!refreshed.ok) throw new Error("Memory settings are temporarily unavailable.");
  return refreshed.json() as Promise<MemoryResponse>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function MemoryRow({ memory, onChanged }: {
  memory: Memory;
  onChanged: (data: MemoryResponse) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(memory.content);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitEdit(event: FormEvent) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || trimmed === memory.content) {
      setContent(memory.content);
      setEditing(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onChanged(await memoryRequest({ action: "edit", id: memory.id, content: trimmed }));
      setEditing(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update memory.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Permanently forget “${memory.content}”?`)) return;
    setBusy(true);
    setError(null);
    try {
      onChanged(await memoryRequest({ action: "delete", id: memory.id }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not delete memory.");
      setBusy(false);
    }
  }

  return (
    <li className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--atlas-color-border)" }}>
      {editing ? (
        <form className="space-y-3" onSubmit={submitEdit}>
          <label className="sr-only" htmlFor={`memory-${memory.id}`}>Memory</label>
          <textarea
            autoFocus
            className="w-full rounded-lg border p-3 text-sm"
            id={`memory-${memory.id}`}
            maxLength={500}
            onChange={(event) => setContent(event.target.value)}
            rows={3}
            value={content}
          />
          <div className="flex gap-2">
            <button className="rounded-lg bg-[var(--atlas-color-accent)] px-3 py-1.5 text-sm text-white" disabled={busy} type="submit">Save</button>
            <button className="rounded-lg border px-3 py-1.5 text-sm" disabled={busy} onClick={() => { setContent(memory.content); setEditing(false); }} type="button">Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <p className="[overflow-wrap:anywhere]">{memory.content}</p>
          <p className="mt-2 text-xs" style={{ color: "var(--atlas-color-text-secondary)" }}>
            {memory.origin === "person_request" ? "You asked Atlas to remember" : "Suggested by Atlas"}
            {" · "}{memory.confidence === "stated" ? "stated" : "inferred"}{" · "}{formatDate(memory.updated_at || memory.created_at)}
          </p>
          <div className="mt-3 flex gap-3 text-sm">
            <button className="hover:underline" disabled={busy} onClick={() => setEditing(true)} type="button">Edit</button>
            <button className="hover:underline" disabled={busy} onClick={() => void remove()} type="button">Delete</button>
          </div>
        </>
      )}
      {error ? <p className="mt-2 text-sm" role="alert">{error}</p> : null}
    </li>
  );
}

export function MemoryManager() {
  const [data, setData] = useState<MemoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await memoryRequest());
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load memories.");
    }
  }, []);

  useEffect(() => {
    void memoryRequest().then(
      (response) => {
        setData(response);
        setError(null);
      },
      (requestError: unknown) => {
        setError(requestError instanceof Error ? requestError.message : "Could not load memories.");
      },
    );
  }, []);

  async function setConsent(granted: boolean) {
    setBusy(true);
    setError(null);
    try {
      setData(await memoryRequest({ action: "consent", granted }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update memory settings.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAll() {
    if (!window.confirm("Permanently delete all memories? This cannot be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      setData(await memoryRequest({ action: "deleteAll" }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not delete memories.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col py-5" aria-labelledby="memory-heading">
      <div className="shrink-0">
        <div className="flex items-start justify-between gap-5">
          <div>
            <h1 className="text-2xl font-medium" id="memory-heading">Memory</h1>
            <p className="mt-1 max-w-xl text-sm" style={{ color: "var(--atlas-color-text-secondary)" }}>
              You choose what Atlas remembers across conversations. You can edit or permanently delete anything here.
            </p>
          </div>
          {data ? (
            <label className="flex shrink-0 items-center gap-2 text-sm">
              <span>{data.consent ? "On" : "Off"}</span>
              <input
                aria-label="Memory"
                checked={data.consent === true}
                disabled={busy}
                onChange={(event) => void setConsent(event.target.checked)}
                role="switch"
                type="checkbox"
              />
            </label>
          ) : null}
        </div>

        {data?.consent === false ? (
          <p className="mt-4 rounded-xl border bg-white p-3 text-sm" style={{ borderColor: "var(--atlas-color-border)" }}>
            Memory is off. Saved memories remain here, but Atlas will not use them or suggest new ones.
          </p>
        ) : null}
        {error ? <p className="mt-4 text-sm" role="alert">{error} <button className="underline" onClick={() => void load()} type="button">Try again</button></p> : null}
        {!data && !error ? <p className="mt-4 text-sm" aria-live="polite">Loading memories…</p> : null}

        {data && data.memories.length > 0 ? (
          <div className="mt-5 flex items-center justify-between">
            <h2 className="text-sm font-medium">Saved memories</h2>
            <button className="text-sm hover:underline" disabled={busy} onClick={() => void deleteAll()} type="button">Delete all memories</button>
          </div>
        ) : null}
      </div>

      {data ? (
        data.memories.length > 0 ? (
          <ul className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pb-4 pr-1">
            {data.memories.map((memory) => <MemoryRow key={memory.id} memory={memory} onChanged={setData} />)}
          </ul>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center text-center text-sm" style={{ color: "var(--atlas-color-text-secondary)" }}>
            <p>Nothing saved yet.<br />Atlas will ask before remembering anything.</p>
          </div>
        )
      ) : null}
    </section>
  );
}

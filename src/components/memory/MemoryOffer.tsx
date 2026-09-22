"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Proposal = {
  content: string;
  origin: "person_request" | "atlas_suggestion";
  confidence: "stated" | "inferred";
  token: string;
};

type ProposalResponse = {
  consent: boolean | null;
  proposals: Proposal[];
};

export function MemoryOffer({ sourceMessageId }: { sourceMessageId: string }) {
  const [result, setResult] = useState<ProposalResponse | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestedFor = useRef<string | null>(null);

  const requestProposals = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/v1/memory/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceMessageId }),
      });
      if (!response.ok) throw new Error("Memory suggestion unavailable.");
      setResult(await response.json() as ProposalResponse);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Memory suggestion unavailable.");
    }
  }, [sourceMessageId]);

  useEffect(() => {
    if (requestedFor.current === sourceMessageId) return;
    requestedFor.current = sourceMessageId;
    setResult(null);
    setDismissed([]);
    void requestProposals();
  }, [requestProposals, sourceMessageId]);

  async function chooseConsent(granted: boolean) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "consent", granted }),
      });
      if (!response.ok) throw new Error("Could not save your choice.");
      if (granted) await requestProposals();
      else setResult({ consent: false, proposals: [] });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not save your choice.");
    } finally {
      setBusy(false);
    }
  }

  async function save(proposal: Proposal) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", token: proposal.token }),
      });
      if (!response.ok) throw new Error("Could not save that memory.");
      setDismissed((current) => [...current, proposal.token]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not save that memory.");
    } finally {
      setBusy(false);
    }
  }

  async function dismiss(proposal: Proposal) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss", token: proposal.token }),
      });
      if (!response.ok) throw new Error("Could not dismiss that suggestion.");
      setDismissed((current) => [...current, proposal.token]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not dismiss that suggestion.");
    } finally {
      setBusy(false);
    }
  }

  if (!result && !error) return null;
  if (result?.consent === null) {
    return (
      <aside aria-label="Memory consent" className="mt-4 rounded-xl border bg-white p-4 text-sm" style={{ borderColor: "var(--atlas-color-border)" }}>
        <p>Atlas can remember things you choose, across conversations. You&apos;ll see everything it remembers and can delete it anytime. Turn on memory?</p>
        <div className="mt-3 flex gap-2">
          <button className="rounded-lg bg-[var(--atlas-color-accent)] px-3 py-1.5 text-white" disabled={busy} onClick={() => void chooseConsent(true)} type="button">Turn on</button>
          <button className="rounded-lg border px-3 py-1.5" disabled={busy} onClick={() => void chooseConsent(false)} type="button">Not now</button>
        </div>
        {error ? <p className="mt-2" role="alert">{error}</p> : null}
      </aside>
    );
  }

  const visible = result?.proposals.filter((proposal) => !dismissed.includes(proposal.token)) ?? [];
  if (visible.length === 0) return error ? <p className="mt-2 text-xs" role="alert">{error}</p> : null;
  return (
    <aside className="mt-4 space-y-2" aria-label="Memory suggestions">
      {visible.map((proposal) => (
        <div className="rounded-xl border bg-white p-3 text-sm" key={proposal.token} style={{ borderColor: "var(--atlas-color-border)" }}>
          <p>Remember: {proposal.content}?</p>
          <div className="mt-2 flex gap-3">
            <button className="font-medium hover:underline" disabled={busy} onClick={() => void save(proposal)} type="button">Remember</button>
            <button className="hover:underline" disabled={busy} onClick={() => void dismiss(proposal)} type="button">No thanks</button>
          </div>
        </div>
      ))}
      {error ? <p className="text-xs" role="alert">{error}</p> : null}
    </aside>
  );
}

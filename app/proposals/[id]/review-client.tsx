"use client";

import { useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import type { ProposalStatus } from "@/lib/db/types";
import { approveProposalAction } from "./actions";

interface Props {
  proposalId: string;
  originalMarkdown: string;
  totalCents: number;
  leadName: string;
  status: ProposalStatus;
}

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US")}`;
}

export function ReviewClient(props: Props) {
  const [draft, setDraft] = useState(props.originalMarkdown);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = draft !== props.originalMarkdown;
  const readonly = props.status !== "draft";

  function onApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveProposalAction({
        proposalId: props.proposalId,
        originalMarkdown: props.originalMarkdown,
        editedMarkdown: draft,
      });
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <main style={{ maxWidth: 1280, margin: "2rem auto", padding: "0 1.5rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", margin: 0 }}>{props.leadName}</h1>
          <div style={{ fontSize: "0.85rem", color: "#666" }}>
            Proposal {props.proposalId.slice(0, 8)} · Status: <strong>{props.status}</strong>
          </div>
        </div>
        <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>{dollars(props.totalCents)}</div>
      </header>

      {error && (
        <div style={{ background: "#fee", border: "1px solid #f99", padding: "0.75rem", borderRadius: 6, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        <section>
          <h2 style={{ fontSize: "1rem", color: "#444", margin: "0 0 0.5rem" }}>
            Edit {dirty && <span style={{ color: "#c60", fontWeight: 400 }}>(unsaved)</span>}
          </h2>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            readOnly={readonly}
            style={{
              width: "100%",
              minHeight: "60vh",
              fontFamily: "ui-monospace, Menlo, monospace",
              fontSize: "0.85rem",
              padding: "0.75rem",
              border: "1px solid #ccc",
              borderRadius: 6,
              boxSizing: "border-box",
            }}
          />
        </section>

        <section>
          <h2 style={{ fontSize: "1rem", color: "#444", margin: "0 0 0.5rem" }}>Preview</h2>
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 6,
              padding: "1rem 1.25rem",
              minHeight: "60vh",
              background: "#fff",
            }}
          >
            <ReactMarkdown>{draft}</ReactMarkdown>
          </div>
        </section>
      </div>

      <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem" }}>
        <button
          onClick={onApprove}
          disabled={pending || readonly}
          style={{
            padding: "0.65rem 1.25rem",
            background: readonly ? "#aaa" : "#0a7",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontWeight: 600,
            cursor: pending || readonly ? "default" : "pointer",
          }}
        >
          {pending ? "Approving…" : readonly ? "Already approved" : "Approve"}
        </button>
        {dirty && !readonly && (
          <span style={{ alignSelf: "center", color: "#666", fontSize: "0.85rem" }}>
            Edits will be saved with this approval.
          </span>
        )}
      </div>
    </main>
  );
}

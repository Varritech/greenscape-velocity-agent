import Link from "next/link";
import { listProposalDrafts } from "@/lib/db/proposals";

export const dynamic = "force-dynamic";

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US")}`;
}

export default async function ProposalsPage() {
  const drafts = await listProposalDrafts();

  return (
    <main style={{ maxWidth: 880, margin: "3rem auto", padding: "0 1.5rem" }}>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>Proposal review queue</h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>
        {drafts.length} draft{drafts.length === 1 ? "" : "s"} awaiting Marcus's review.
      </p>
      {drafts.length === 0 ? (
        <p style={{ color: "#888" }}>No drafts. Site walks turn into proposals here.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {drafts.map((d) => (
            <li
              key={d.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: "1rem 1.25rem",
                marginBottom: "0.75rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div>
                  <Link href={`/proposals/${d.id}`} style={{ fontSize: "1.05rem", fontWeight: 600 }}>
                    Proposal {d.id.slice(0, 8)}
                  </Link>
                  <div style={{ fontSize: "0.85rem", color: "#666" }}>
                    Lead {d.lead_id.slice(0, 8)} · {new Date(d.created_at).toLocaleString()}
                  </div>
                </div>
                <div style={{ fontWeight: 600 }}>{dollars(d.total_cents)}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

import { notFound } from "next/navigation";
import { getProposalWithLead } from "@/lib/db/proposals";
import { ReviewClient } from "./review-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProposalReviewPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getProposalWithLead(id);
  if (!data) notFound();

  const raw = (data.lead.raw_payload ?? {}) as {
    first_name?: string;
    last_name?: string;
  };
  const leadName = `${raw.first_name ?? ""} ${raw.last_name ?? ""}`.trim() || "Unnamed lead";

  return (
    <ReviewClient
      proposalId={data.proposal.id}
      originalMarkdown={data.proposal.markdown}
      totalCents={data.proposal.total_cents}
      leadName={leadName}
      status={data.proposal.status}
    />
  );
}

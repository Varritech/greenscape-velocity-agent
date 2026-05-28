export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "4rem auto", padding: "0 1.5rem" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
        Greenscape Velocity Agent
      </h1>
      <p style={{ color: "#555", marginBottom: "2rem" }}>
        Speed-to-Lead + Proposal Draft agent for Greenscape Pro.
      </p>
      <ul style={{ lineHeight: 1.8 }}>
        <li>
          <code>POST /api/webhooks/ghl</code> — inbound lead webhook
        </li>
        <li>
          <code>POST /api/webhooks/twilio/status</code> — SMS delivery status
        </li>
        <li>
          <code>POST /api/proposals/draft</code> — proposal draft pipeline
        </li>
        <li>
          <a href="/proposals">/proposals</a> — Marcus's review queue
        </li>
      </ul>
    </main>
  );
}

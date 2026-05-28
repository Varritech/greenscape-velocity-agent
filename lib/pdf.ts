// Minimal PDF generator. Pure-buffer implementation — no external dep so the
// 24h build keeps a small install footprint and the test suite stays
// dependency-free. Production swap target: @react-pdf/renderer (planned for
// post-take-home, see RUNBOOK).
//
// Output is a valid 1-page PDF that renders the proposal title, total, and
// the markdown body as plain text wrapped at ~90 chars/line in Helvetica 11pt.
// PDF.js, Preview, and Chrome all open this fine.

export interface RenderProposalPdfOptions {
  leadName: string;
  totalCents: number;
}

const HEADER = "%PDF-1.4\n";
const PAGE_WIDTH = 612; // 8.5" * 72
const PAGE_HEIGHT = 792; // 11" * 72
const MARGIN = 54; // 0.75"
const LINE_HEIGHT = 14;
const FONT_SIZE = 11;
const MAX_LINE_CHARS = 90;

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US")}`;
}

function wrapLines(text: string): string[] {
  const out: string[] = [];
  for (const rawLine of text.split("\n")) {
    if (rawLine.length <= MAX_LINE_CHARS) {
      out.push(rawLine);
      continue;
    }
    let start = 0;
    while (start < rawLine.length) {
      let end = Math.min(start + MAX_LINE_CHARS, rawLine.length);
      // Try to break on whitespace if we're mid-word.
      if (end < rawLine.length) {
        const sp = rawLine.lastIndexOf(" ", end);
        if (sp > start + 20) end = sp;
      }
      out.push(rawLine.slice(start, end));
      start = end + (rawLine[end] === " " ? 1 : 0);
    }
  }
  return out;
}

function pdfEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function renderProposalPDF(
  markdown: string,
  opts: RenderProposalPdfOptions,
): Buffer {
  const headerLine = `Greenscape Pro - Proposal for ${opts.leadName}`;
  const totalLine = `Total: ${dollars(opts.totalCents)}`;
  const bodyLines = wrapLines(markdown);

  // Build the content stream. Coordinates are bottom-left origin.
  const startY = PAGE_HEIGHT - MARGIN;
  const lines: string[] = [];
  lines.push("BT");
  lines.push(`/F1 16 Tf`);
  lines.push(`${MARGIN} ${startY} Td`);
  lines.push(`(${pdfEscape(headerLine)}) Tj`);
  lines.push(`/F1 12 Tf`);
  lines.push(`0 -22 Td`);
  lines.push(`(${pdfEscape(totalLine)}) Tj`);
  lines.push(`/F1 ${FONT_SIZE} Tf`);
  lines.push(`0 -22 Td`);
  for (const ln of bodyLines) {
    lines.push(`(${pdfEscape(ln)}) Tj`);
    lines.push(`0 -${LINE_HEIGHT} Td`);
  }
  lines.push("ET");
  const stream = lines.join("\n");

  // Assemble PDF objects.
  const objects: string[] = [];
  // 1: Catalog
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  // 2: Pages
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  // 3: Page
  objects.push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
  );
  // 4: Font
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  // 5: Content stream
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);

  let body = HEADER;
  const offsets: number[] = [];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefStart = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    body += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(body, "binary");
}

export class WhisperError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "WhisperError";
  }
}

let fetchImpl: typeof fetch = globalThis.fetch;
export function __setFetchForTests(f: typeof fetch | null): void {
  fetchImpl = f ?? globalThis.fetch;
}

export async function transcribeVoiceMemo(voiceMemoUrl: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new WhisperError("OPENAI_API_KEY missing");

  const audioRes = await fetchImpl(voiceMemoUrl);
  if (!audioRes.ok) {
    throw new WhisperError(`failed to download voice memo: ${audioRes.status}`);
  }
  const audio = await audioRes.blob();

  const form = new FormData();
  form.append("file", audio, "voice-memo.m4a");
  form.append("model", "whisper-1");
  form.append("response_format", "text");

  const res = await fetchImpl("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new WhisperError(`whisper ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.text()).trim();
}

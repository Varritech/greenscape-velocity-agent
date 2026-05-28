import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Prompt versioning rule: the SHA below pins the exact commit on
// greenscape-velocity-prompts that produced these copies. Every qualification
// row writes this SHA so a months-old decision can be replayed against the
// exact prompt that produced it. To bump:
//   1. PR the prompt change on greenscape-velocity-prompts
//   2. Copy the updated files into lib/prompts/<new-version>/
//   3. Update QUALIFIER_PROMPT_SHA and QUALIFIER_DIR below
//   4. Add a row to lib/prompts/CHANGELOG.md (TODO)
export const QUALIFIER_PROMPT_SHA = "6e462fc";
const QUALIFIER_DIR = "qualifier-v1.0.0";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface QualifierPrompt {
  system: string;
  user_template: string;
  sha: string;
}

let cached: QualifierPrompt | null = null;

export function loadQualifierPrompt(): QualifierPrompt {
  if (cached) return cached;
  const base = path.join(__dirname, "prompts", QUALIFIER_DIR);
  cached = {
    system: readFileSync(path.join(base, "system.md"), "utf8"),
    user_template: readFileSync(path.join(base, "user.template.md"), "utf8"),
    sha: QUALIFIER_PROMPT_SHA,
  };
  return cached;
}

export function fillTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : "",
  );
}

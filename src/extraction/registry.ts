import type { SourceExtractor } from "./source-extractor.js";

/**
 * Default extractor list wired into the CLI. Phase 2 ships with no built-in
 * extractors — `akp refresh` will exit with `AKP_NO_EXTRACTORS_REGISTERED`
 * until a domain pack is added here. The TypeScript code-repo extractor
 * lands in Phase 3 and will be the first entry.
 */
export function defaultExtractors(): readonly SourceExtractor[] {
  return [];
}

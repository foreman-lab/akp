import { tsRepoExtractor } from "./extractors/ts-repo/index.js";

import type { SourceExtractor } from "./source-extractor.js";

/**
 * Default extractor list wired into the CLI. Currently ships one extractor —
 * `ts-repo`, which emits `module` objects from top-level directories under
 * `<rootDir>/src/`. Future TDD cycles extend it to symbol level and may add
 * additional extractors (e.g. for docs, OpenAPI specs, etc.).
 */
export function defaultExtractors(): readonly SourceExtractor[] {
  return [tsRepoExtractor()];
}

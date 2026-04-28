import path from "node:path";

export function fixturePath(name: string): string {
  return path.resolve("tests/fixtures", name);
}

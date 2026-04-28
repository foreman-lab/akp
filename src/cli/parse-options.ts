import { InvalidArgumentError } from "commander";

export function parsePositiveInt(value: string, previous: number | undefined, max: number): number {
  if (!/^\d+$/.test(value)) {
    throw new InvalidArgumentError("must be a positive integer");
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new InvalidArgumentError("must be a positive integer");
  }

  if (parsed > max) {
    throw new InvalidArgumentError(`must be less than or equal to ${max}`);
  }

  return parsed;
}

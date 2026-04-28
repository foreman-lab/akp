export interface GreetInput {
  name: string;
}

export interface GreetUseCase {
  execute(input: GreetInput): string;
}

export function makeGreet(): GreetUseCase {
  return {
    execute({ name }) {
      return `Hello, ${name}!`;
    },
  };
}

export interface FarewellUseCase {
  execute(): string;
}

export function makeFarewellMessage(): FarewellUseCase {
  return {
    execute() {
      return "Goodbye.";
    },
  };
}

export interface AsyncOperationUseCase {
  execute(): Promise<string>;
}

// `async function` factories are idiomatic for I/O-touching use cases —
// the extractor must pick them up alongside their sync siblings.
export async function makeAsyncOperation(): Promise<AsyncOperationUseCase> {
  return {
    async execute() {
      return "ok";
    },
  };
}

export interface HTTPClientUseCase {
  execute(): string;
}

// Consecutive caps in the factory name — exercises the kebabCase
// two-pass replace (HTTPClient -> http-client, not h-t-t-p-client).
export function makeHTTPClient(): HTTPClientUseCase {
  return {
    execute() {
      return "client";
    },
  };
}

// Should NOT be emitted: not exported.
function makeInternalHelper(): string {
  return "internal";
}

void makeInternalHelper;

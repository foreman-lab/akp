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

// Should NOT be emitted: not exported.
function makeInternalHelper(): string {
  return "internal";
}

void makeInternalHelper;

// Two exported interfaces with the `Port` suffix — must be emitted as
// port.clock and port.logger. The other declarations exercise the negative
// rules: `NotAPort` lacks the suffix, `InternalPort` is not exported.

export interface ClockPort {
  now(): Date;
}

export interface LoggerPort {
  info(message: string): void;
}

export interface PlainInterface {
  doSomething(): void;
}

interface InternalPort {
  hidden(): void;
}

const _typecheck: InternalPort = { hidden() {} };
void _typecheck;

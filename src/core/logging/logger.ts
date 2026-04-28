import pino from "pino";

export function createLogger(name = "akp") {
  return pino({
    name,
    level: process.env.AKP_LOG_LEVEL ?? "info",
    redact: {
      paths: ["*.secret", "*.token", "*.password", "*.apiKey", "*.authorization"],
      remove: true,
    },
  });
}

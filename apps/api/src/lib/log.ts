// Lightweight structured logger for the API. Emits single-line, timestamped,
// leveled records so Railway's log view stays readable and greppable.
//
// PRIVACY: this is for OPERATIONAL visibility only. ip-speil makes a
// no-request-logs promise, so never pass a visitor's IP address — or a raw
// request query string, which may carry `?ip=` — as a field. Log shapes, counts,
// outcomes, and timings; not who was on the other end.
//
// Verbosity is controlled by LOG_LEVEL (debug|info|warn|error), default "info".

type Level = "debug" | "info" | "warn" | "error";

type FieldValue = string | number | boolean | null | undefined;
export type Fields = Record<string, FieldValue>;

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const envLevel = process.env.LOG_LEVEL as Level | undefined;
const threshold = LEVELS[envLevel && envLevel in LEVELS ? envLevel : "info"];

function formatValue(value: string | number | boolean | null): string {
  const str = String(value);
  // Quote anything with whitespace so `key=val` pairs stay unambiguous.
  return /[\s"]/.test(str) ? JSON.stringify(str) : str;
}

function format(level: Level, msg: string, fields?: Fields): string {
  const parts = [new Date().toISOString(), level.toUpperCase().padEnd(5), msg];
  if (fields) {
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      parts.push(`${key}=${formatValue(value)}`);
    }
  }
  return parts.join(" ");
}

function emit(level: Level, msg: string, fields?: Fields): void {
  if (LEVELS[level] < threshold) return;
  const line = format(level, msg, fields);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, fields?: Fields) => emit("debug", msg, fields),
  info: (msg: string, fields?: Fields) => emit("info", msg, fields),
  warn: (msg: string, fields?: Fields) => emit("warn", msg, fields),
  error: (msg: string, fields?: Fields) => emit("error", msg, fields),
} as const;

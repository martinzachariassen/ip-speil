// Tiny classname joiner — filters out falsy values so conditional classes read
// cleanly at call sites. Kept dependency-free (no clsx/classnames).
export type ClassValue = string | false | null | undefined;

export function cx(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}

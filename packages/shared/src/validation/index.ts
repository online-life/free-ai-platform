export function requireString(
  value: unknown,
  name: string,
  minLength = 1,
  maxLength = 255
): string {
  if (
    typeof value !== "string" ||
    value.length < minLength ||
    value.length > maxLength
  ) {
    throw new Error(`Invalid ${name}`);
  }

  return value;
}

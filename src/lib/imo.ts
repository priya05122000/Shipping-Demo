/** IMO ship numbers: seven digits, the last a check digit. Written with or without the "IMO" prefix, e.g. "IMO 9074729". */

/** "IMO 9074729" or "imo9074729" -> "9074729". Anything else is returned trimmed, for validateImo to reject. */
export function normalizeImo(value: string): string {
  return value.trim().replace(/^imo\s*/i, "");
}

/** Null if `value` (already normalized) is a valid IMO number, otherwise why not. */
export function validateImo(value: string): string | null {
  if (!/^\d{7}$/.test(value)) return "IMO number must be 7 digits, e.g. 9074729.";
  // The first six digits times 7, 6, 5, 4, 3, 2; the sum's last digit is the check digit.
  const sum = [...value.slice(0, 6)].reduce((total, digit, i) => total + Number(digit) * (7 - i), 0);
  return sum % 10 === Number(value[6]) ? null : "That isn't a valid IMO number: its check digit doesn't match.";
}

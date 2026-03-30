/**
 * NZ IRD number validation using the modulo-11 check digit algorithm.
 * IRD numbers are 8 or 9 digits. 8-digit numbers are left-padded to 9.
 *
 * Algorithm:
 * 1. Apply primary weights [3,2,7,6,5,4,3,2] to first 8 digits, sum products
 * 2. remainder = sum % 11. If remainder == 0, check digit is 0
 * 3. If remainder != 0, check digit = 11 - remainder
 * 4. If check digit < 10 and matches digit 9, valid
 * 5. If check digit >= 10, apply secondary weights [7,4,3,2,5,2,7,6] and repeat
 */

const PRIMARY_WEIGHTS = [3, 2, 7, 6, 5, 4, 3, 2];
const SECONDARY_WEIGHTS = [7, 4, 3, 2, 5, 2, 7, 6];

export type IrdValidationResult = {
  valid: boolean;
  formatted: string | null;
  error?: string;
};

export function validateIrdNumber(input: string): IrdValidationResult {
  // Strip non-digits
  const digits = input.replace(/\D/g, "");

  if (digits.length === 0) {
    return { valid: false, formatted: null, error: "IRD number is required" };
  }

  if (digits.length < 8 || digits.length > 9) {
    return { valid: false, formatted: null, error: "IRD number must be 8 or 9 digits" };
  }

  // Left-pad 8-digit numbers to 9
  const padded = digits.padStart(9, "0");
  const nums = padded.split("").map(Number);
  const checkDigit = nums[8];

  // Try primary weights
  const primaryResult = computeCheckDigit(nums, PRIMARY_WEIGHTS);
  if (primaryResult !== null && primaryResult === checkDigit) {
    return { valid: true, formatted: formatIrd(padded) };
  }

  // If primary check digit >= 10, try secondary weights
  if (primaryResult === null || primaryResult >= 10) {
    const secondaryResult = computeCheckDigit(nums, SECONDARY_WEIGHTS);
    if (secondaryResult !== null && secondaryResult === checkDigit) {
      return { valid: true, formatted: formatIrd(padded) };
    }
  }

  return { valid: false, formatted: null, error: "Invalid IRD number (check digit failed)" };
}

function computeCheckDigit(digits: number[], weights: number[]): number | null {
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += digits[i] * weights[i];
  }

  const remainder = sum % 11;
  if (remainder === 0) return 0;

  const check = 11 - remainder;
  return check; // Caller checks if < 10
}

function formatIrd(padded: string): string {
  // Format as XXX-XXX-XXX
  return `${padded.slice(0, 3)}-${padded.slice(3, 6)}-${padded.slice(6, 9)}`;
}

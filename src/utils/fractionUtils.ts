import type { Fraction } from "@/types";

const fractionToNumber = (fraction: Fraction): number =>
  fraction[0] / fraction[1];
const gcd = (a: number, b: number): number => b === 0 ? Math.abs(a) : gcd(b, a % b)


export const toFraction = (value: number): Fraction => {
  const tolerance = 1.0e-8;

  if (Math.abs(value - Math.round(value)) < tolerance) {
    return [Math.round(value), 1];
  }

  let bestNumerator = 1;
  let bestDenominator = 1;
  let bestError = Math.abs(value - 1);

  for (let denominator = 1; denominator <= 1000; denominator++) {
    const numerator = Math.round(value * denominator);
    const error = Math.abs(value - numerator / denominator);
    if (error < bestError) {
      bestError = error;
      bestNumerator = numerator;
      bestDenominator = denominator;
    }
  }

  const divisor = gcd(bestNumerator, bestDenominator);
  return [bestNumerator / divisor, bestDenominator / divisor];
};

export const formatValue = (
  value: number | Fraction,
  useFractions: boolean
): string => {
  if (useFractions) {
    const fraction = Array.isArray(value) ? value : toFraction(value);
    const [n, d] = fraction;

    if (d === 1) return n.toString();
    if (d < 0) return `-${n}/${-d}`;
    return `${n}/${d}`;
  }

  const num = Array.isArray(value) ? fractionToNumber(value) : value;

  if (Math.abs(num - Math.round(num)) < 1e-6) {
    return Math.round(num).toString();
  }
  if (num) {
    return num.toFixed(4).replace(/\.?0+$/, '');
  }

  return ""
};

export const formatTableauValue = (value: number, useFractions: boolean): string | Fraction => {
  if (!useFractions) {
    if (Math.abs(value - Math.round(value)) < 1e-6) {
      return Math.round(value).toString();
    }
    return value.toFixed(4).replace(/\.?0+$/, '');
  } else {
    return toFraction(value);
  }
};

/**
 * Parses user numeric input supporting both decimals ("4.5") and fractions ("9/2").
 * Returns fallback for invalid input (e.g. "abc", "1/0").
 */
export const parseNumericInput = (rawValue: string, fallback = 0): number => {
  const normalized = rawValue.trim();

  if (!normalized) {
    return fallback;
  }

  if (normalized.includes('/')) {
    const [left, right, ...rest] = normalized.split('/').map(part => part.trim());

    if (rest.length > 0 || !left || !right) {
      return fallback;
    }

    const numerator = Number(left);
    const denominator = Number(right);

    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
      return fallback;
    }

    return numerator / denominator;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// Функция для форматирования чисел в UI компонентах
export const formatDisplayValue = (value: number, useFractions: boolean): string => {
  if (useFractions) {
    const fraction = toFraction(value);
    return formatValue(fraction, true);
  } else {
    if (Math.abs(value - Math.round(value)) < 1e-6) {
      return Math.round(value).toString();
    }
    return value.toFixed(4).replace(/\.?0+$/, '');
  }
};

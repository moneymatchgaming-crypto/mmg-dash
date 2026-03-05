import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a token price with appropriate precision.
 * - >= $1:       $1,234.56
 * - >= $0.01:    $0.0456
 * - >= $0.0001:  $0.000123
 * - < $0.0001:   $0.00000815 (up to 8 sig figs)
 */
export function formatPrice(price: number): string {
  if (price === 0) return "$0.00";
  if (price >= 1) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(price);
  }
  if (price >= 0.01) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(price);
  }
  if (price >= 0.0001) {
    return "$" + price.toFixed(6).replace(/0+$/, "");
  }
  // Very small — show up to 8 significant figures
  return "$" + price.toPrecision(4).replace(/\.?0+$/, "");
}

/** Returns true if a token looks like a spam/phishing airdrop. */
export function isSpamToken(symbol: string, name: string): boolean {
  const haystack = `${symbol} ${name}`.toLowerCase();
  const spamPatterns = [
    /\.(com|xyz|io|net|org|finance|app|gg|vip|site|club)\b/,
    /t\.me\//,
    /http/,
    /\bclaim\b/,
    /\bredeem\b/,
    /\bvisit\b/,
    /\bairdrop\b/,
    /\breward:/i,
    /@\w+/,
    /\*claim/,
  ];
  return spamPatterns.some((re) => re.test(haystack));
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

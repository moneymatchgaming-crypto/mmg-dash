/**
 * Covalent / GoldRush API client for Base.
 *
 * A single call to /balances_v2/ returns:
 *   - ALL ERC-20 token balances (no pagination needed)
 *   - Token metadata (symbol, name, decimals, logo)
 *   - Current USD price + 24h change for every token
 *   - Native ETH balance
 *   - Built-in spam filter
 *
 * This replaces the Alchemy pagination + metadata + CoinGecko/DefiLlama pipeline
 * with a single ~300ms round-trip.
 */

import type { Address } from "viem";
import type { TokenBalance, PriceMap, TokenPrice } from "./types";
import { ETH_NATIVE_KEY } from "./constants";
import { formatTokenAmount } from "./math";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CovalentItem {
  contract_decimals: number;
  contract_name: string;
  contract_ticker_symbol: string;
  contract_address: string;
  logo_url: string | null;
  /** Current USD price per token */
  quote_rate: number | null;
  /** USD price per token 24h ago (used to compute % change) */
  quote_rate_24h: number | null;
  /** Raw balance as a decimal string */
  balance: string;
  is_spam: boolean;
  /** true for native ETH — contract_address will be 0xeeee...eeee */
  native_token: boolean;
}

interface CovalentResponse {
  data: { items: CovalentItem[] } | null;
  error: boolean;
  error_message: string | null;
}

export interface CovalentPortfolioData {
  /** ERC-20 token balances (native ETH excluded — see nativeETH) */
  balances: TokenBalance[];
  /** Native ETH balance, or null if not present */
  nativeETH: { balanceFormatted: number } | null;
  /** Price map for all tokens that Covalent priced (keyed by lowercase address) */
  priceMap: PriceMap;
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

/**
 * Fetch all token balances for a wallet on Base via Covalent.
 * Returns balances, native ETH, and a full price map in one HTTP call.
 */
export async function fetchCovalentPortfolio(
  address: Address
): Promise<CovalentPortfolioData> {
  const key = process.env.NEXT_PUBLIC_COVALENT_API_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_COVALENT_API_KEY is not set");

  const res = await fetch(
    `https://api.covalenthq.com/v1/base-mainnet/address/${address}/balances_v2/` +
      `?quote-currency=USD&nft=false&no-nft-fetch=true`,
    { headers: { Authorization: `Bearer ${key}` } }
  );

  if (!res.ok) throw new Error(`Covalent HTTP ${res.status}`);

  const json = (await res.json()) as CovalentResponse;
  if (json.error || !json.data) {
    throw new Error(json.error_message ?? "Covalent returned an error");
  }

  const balances: TokenBalance[] = [];
  const priceMap: PriceMap = new Map();
  let nativeETH: { balanceFormatted: number } | null = null;

  for (const item of json.data.items) {
    if (item.is_spam) continue;

    const rawBalance = BigInt(item.balance ?? "0");
    if (rawBalance === 0n) continue;

    const balanceFormatted = formatTokenAmount(rawBalance, item.contract_decimals);

    // Build price entry whenever Covalent gives us a price
    if (item.quote_rate && item.quote_rate > 0) {
      const change24hPct =
        item.quote_rate_24h && item.quote_rate_24h > 0
          ? ((item.quote_rate - item.quote_rate_24h) / item.quote_rate_24h) * 100
          : null;

      const priceEntry: TokenPrice = {
        priceUSD: item.quote_rate,
        change24hPct,
        source: "coingecko", // Covalent sources prices from CoinGecko
      };

      if (item.native_token) {
        priceMap.set(ETH_NATIVE_KEY, priceEntry);
      } else {
        priceMap.set(item.contract_address.toLowerCase(), priceEntry);
      }
    }

    // Native ETH: store separately, don't add to ERC-20 list
    if (item.native_token) {
      nativeETH = { balanceFormatted };
      continue;
    }

    balances.push({
      contractAddress: item.contract_address.toLowerCase() as Address,
      rawBalance,
      balanceFormatted,
      symbol: item.contract_ticker_symbol || "???",
      name:   item.contract_name        || "Unknown Token",
      decimals: item.contract_decimals,
      logoURI:  item.logo_url ?? undefined,
    });
  }

  return { balances, nativeETH, priceMap };
}

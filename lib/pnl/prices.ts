/**
 * Price fetching with three-tier fallback:
 *   1. CoinGecko (batch, includes 24h change)
 *   2. DefiLlama  (batch, no rate limit)
 *   3. DexScreener (single token, last resort)
 */

import { COINGECKO_PLATFORM, ETH_NATIVE_KEY } from "./constants";
import type { PriceMap, TokenPrice, PriceSource } from "./types";

// ─── CoinGecko ───────────────────────────────────────────────────────────────

/**
 * Fetch prices for a list of contract addresses on Base via CoinGecko.
 * Free tier: 30 req/min. All addresses in one call.
 * Returns addresses that got a price (others silently missing → DefiLlama handles them).
 */
async function fetchCoinGeckoPrices(
  contractAddresses: string[]
): Promise<PriceMap> {
  const map: PriceMap = new Map();
  if (contractAddresses.length === 0) return map;

  const key = process.env.NEXT_PUBLIC_COINGECKO_API_KEY;
  const baseUrl = key
    ? "https://pro-api.coingecko.com/api/v3"
    : "https://api.coingecko.com/api/v3";
  const headers: Record<string, string> = key
    ? { "x-cg-pro-api-key": key }
    : {};

  try {
    // Token prices
    const tokenAddrs = contractAddresses.filter((a) => a !== ETH_NATIVE_KEY);
    if (tokenAddrs.length > 0) {
      const url =
        `${baseUrl}/simple/token_price/${COINGECKO_PLATFORM}` +
        `?contract_addresses=${tokenAddrs.join(",")}&vs_currencies=usd&include_24hr_change=true`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json() as Record<string, { usd?: number; usd_24h_change?: number }>;
        for (const [addr, info] of Object.entries(data)) {
          if (info.usd !== undefined) {
            map.set(addr.toLowerCase(), {
              priceUSD: info.usd,
              change24hPct: info.usd_24h_change ?? null,
              source: "coingecko",
            });
          }
        }
      }
    }

    // Native ETH price
    if (contractAddresses.includes(ETH_NATIVE_KEY)) {
      const ethUrl = `${baseUrl}/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true`;
      const res = await fetch(ethUrl, { headers });
      if (res.ok) {
        const data = await res.json() as { ethereum?: { usd?: number; usd_24h_change?: number } };
        if (data.ethereum?.usd !== undefined) {
          map.set(ETH_NATIVE_KEY, {
            priceUSD: data.ethereum.usd,
            change24hPct: data.ethereum.usd_24h_change ?? null,
            source: "coingecko",
          });
        }
      }
    }
  } catch {
    // Silent — let DefiLlama handle misses
  }

  return map;
}

// ─── DefiLlama ───────────────────────────────────────────────────────────────

/**
 * Batch price fetch via DefiLlama. No API key needed, no rate limit for normal use.
 * Supports both contract addresses and native ETH.
 */
async function fetchDefiLlamaPrices(addresses: string[]): Promise<PriceMap> {
  const map: PriceMap = new Map();
  if (addresses.length === 0) return map;

  try {
    // Map addresses to DefiLlama coin format
    const coins = addresses.map((a) =>
      a === ETH_NATIVE_KEY ? "coingecko:ethereum" : `base:${a.toLowerCase()}`
    );

    const url = `https://coins.llama.fi/prices/current/${coins.join(",")}`;
    const res = await fetch(url);
    if (!res.ok) return map;

    const data = await res.json() as {
      coins: Record<string, { price?: number; symbol?: string }>;
    };

    for (const [coin, info] of Object.entries(data.coins)) {
      if (info.price === undefined) continue;
      const price: TokenPrice = { priceUSD: info.price, change24hPct: null, source: "defillama" };

      if (coin === "coingecko:ethereum") {
        map.set(ETH_NATIVE_KEY, price);
      } else {
        // coin format: "base:0x..."
        const addr = coin.replace("base:", "").toLowerCase();
        map.set(addr, price);
      }
    }

    // Try to get 24h changes via DefiLlama percentage endpoint
    const changeRes = await fetch(
      `https://coins.llama.fi/percentage/${coins.join(",")}?period=24h`
    );
    if (changeRes.ok) {
      const changeData = await changeRes.json() as { coins: Record<string, number> };
      for (const [coin, pct] of Object.entries(changeData.coins)) {
        const key =
          coin === "coingecko:ethereum"
            ? ETH_NATIVE_KEY
            : coin.replace("base:", "").toLowerCase();
        const existing = map.get(key);
        if (existing) map.set(key, { ...existing, change24hPct: pct });
      }
    }
  } catch {
    // Silent
  }

  return map;
}

// ─── DexScreener ─────────────────────────────────────────────────────────────

/** Single-token last-resort lookup. Only called for addresses that failed both above. */
async function fetchDexScreenerPrice(tokenAddress: string): Promise<TokenPrice | null> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
    );
    if (!res.ok) return null;
    const data = await res.json() as {
      pairs?: Array<{ priceUsd?: string; priceChange?: { h24?: number }; liquidity?: { usd?: number } }>;
    };

    // Pick the most liquid pair
    const pairs = (data.pairs ?? [])
      .filter((p) => p.priceUsd && (p.liquidity?.usd ?? 0) > 1000)
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));

    if (!pairs.length || !pairs[0].priceUsd) return null;
    return {
      priceUSD: parseFloat(pairs[0].priceUsd!),
      change24hPct: pairs[0].priceChange?.h24 ?? null,
      source: "dexscreener",
    };
  } catch {
    return null;
  }
}

// ─── Main entry point ────────────────────────────────────────────────────────

/**
 * Fetch prices for an array of addresses using the cascade:
 *   CoinGecko → DefiLlama → DexScreener (last resort, per-token)
 *
 * Pass ETH_NATIVE_KEY for native ETH price.
 * Always deduplicates input addresses before fetching.
 */
export async function fetchPricesWithFallback(
  rawAddresses: string[]
): Promise<PriceMap> {
  const addresses = [...new Set(rawAddresses.map((a) => a.toLowerCase()))];
  const finalMap: PriceMap = new Map();

  // Stage 1: CoinGecko (batch)
  const cgMap = await fetchCoinGeckoPrices(addresses);
  cgMap.forEach((v, k) => finalMap.set(k, v));

  // Stage 2: DefiLlama for misses
  const llMissing = addresses.filter((a) => !finalMap.has(a));
  if (llMissing.length > 0) {
    const llMap = await fetchDefiLlamaPrices(llMissing);
    llMap.forEach((v, k) => finalMap.set(k, v));
  }

  // Stage 3: DexScreener for remaining misses (skip ETH_NATIVE_KEY)
  const dsMissing = addresses.filter(
    (a) => !finalMap.has(a) && a !== ETH_NATIVE_KEY
  );
  await Promise.allSettled(
    dsMissing.map(async (addr) => {
      const price = await fetchDexScreenerPrice(addr);
      if (price) finalMap.set(addr, price);
    })
  );

  return finalMap;
}

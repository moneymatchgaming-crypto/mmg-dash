"use client";

import { useQuery } from "@tanstack/react-query";
import { STALE_TIMES, ADDRESSES, ETH_NATIVE_KEY } from "@/lib/pnl/constants";
import type { PriceMap, TokenPrice } from "@/lib/pnl/types";

/**
 * Fetches USD prices for an array of token contract addresses.
 * Always includes native ETH and WETH.
 *
 * Calls /api/prices (server-side) → avoids browser CORS limits and keeps
 * API keys off the client bundle.
 *
 * Price cascade: CoinGecko → DefiLlama → DexScreener (see lib/pnl/prices.ts)
 */
export function usePrices(
  tokenAddresses: string[],
  options?: { enabled?: boolean }
): {
  priceMap: PriceMap;
  isLoading: boolean;
} {
  // Deduplicate + always include ETH and WETH
  const allAddresses = [
    ...new Set([
      ETH_NATIVE_KEY,
      ADDRESSES.WETH.toLowerCase(),
      ...tokenAddresses.map((a) => a.toLowerCase()),
    ]),
  ];

  const fetchEnabled = options?.enabled !== false;

  const { data, isPending } = useQuery<PriceMap>({
    queryKey: ["prices", [...allAddresses].sort()],
    queryFn: async (): Promise<PriceMap> => {
      const res = await fetch("/api/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses: allAddresses }),
      });

      if (!res.ok) throw new Error(`/api/prices returned ${res.status}`);

      const json = await res.json() as {
        prices: Record<string, { priceUSD: number; change24hPct: number | null; source: string }>;
      };

      const map: PriceMap = new Map();
      for (const [addr, price] of Object.entries(json.prices)) {
        map.set(addr, price as TokenPrice);
      }

      // WETH == ETH price
      if (!map.has(ADDRESSES.WETH.toLowerCase())) {
        const ethPrice = map.get(ETH_NATIVE_KEY);
        if (ethPrice) map.set(ADDRESSES.WETH.toLowerCase(), { ...ethPrice });
      }

      return map;
    },
    staleTime: STALE_TIMES.PRICES,
    refetchInterval: STALE_TIMES.PRICES,
    enabled: fetchEnabled && allAddresses.length > 0,
  });

  return {
    priceMap: data ?? new Map(),
    isLoading: isPending,
  };
}

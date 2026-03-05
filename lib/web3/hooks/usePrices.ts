"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchPricesWithFallback } from "@/lib/pnl/prices";
import { STALE_TIMES, ADDRESSES, ETH_NATIVE_KEY } from "@/lib/pnl/constants";
import type { PriceMap } from "@/lib/pnl/types";

/**
 * Fetches USD prices for an array of token contract addresses.
 * Always includes native ETH.
 * Results are keyed by lowercase address.
 *
 * CoinGecko → DefiLlama → DexScreener cascade (see lib/pnl/prices.ts).
 */
export function usePrices(tokenAddresses: string[]): {
  priceMap: PriceMap;
  isLoading: boolean;
} {
  // Deduplicate + always include ETH and WETH (same price)
  const allAddresses = [
    ...new Set([
      ETH_NATIVE_KEY,
      ADDRESSES.WETH.toLowerCase(),
      ...tokenAddresses.map((a) => a.toLowerCase()),
    ]),
  ];

  const { data, isPending } = useQuery<PriceMap>({
    queryKey: ["prices", [...allAddresses].sort()],
    queryFn: async () => {
      const map = await fetchPricesWithFallback(allAddresses);
      // WETH == ETH price
      if (!map.has(ADDRESSES.WETH.toLowerCase())) {
        const ethPrice = map.get(ETH_NATIVE_KEY);
        if (ethPrice) map.set(ADDRESSES.WETH.toLowerCase(), { ...ethPrice });
      }
      return map;
    },
    staleTime: STALE_TIMES.PRICES,
    refetchInterval: STALE_TIMES.PRICES,
    enabled: allAddresses.length > 0,
  });

  return {
    priceMap: data ?? new Map(),
    isLoading: isPending,
  };
}

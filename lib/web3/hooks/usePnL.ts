"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { getAlchemyUrl, hasAlchemyKey } from "@/lib/pnl/alchemy";
import {
  fetchTransferHistory,
  fetchHistoricalPrices,
  computeTokenPnL,
} from "@/lib/pnl/history";
import type { TokenPnL } from "@/lib/pnl/history";
import type { PriceMap } from "@/lib/pnl/types";

export interface PnLResult {
  tokens: TokenPnL[];
  totalUnrealizedPnL: number | null;
  totalRealizedPnL: number;
  totalCurrentValue: number;
  totalCostBasis: number | null;
  tokensWithHistory: number;
  tokensWithoutHistory: number;
}

export function usePnL(address?: Address, priceMap?: PriceMap) {
  return useQuery<PnLResult>({
    queryKey: ["pnl", address],
    queryFn: async (): Promise<PnLResult> => {
      if (!address) return emptyResult();
      if (!hasAlchemyKey()) {
        throw new Error("Alchemy API key required for PnL tracking");
      }

      const url = getAlchemyUrl()!;

      // 1. Fetch full transfer history
      const transfers = await fetchTransferHistory(url, address);

      // 2. Collect (contractAddress, timestamp) pairs for buys only
      const priceRequests = transfers
        .filter((t) => t.direction === "in")
        .map((t) => ({ contractAddress: t.contractAddress, timestampMs: t.timestampMs }));

      // 3. Fetch historical prices for all buy events
      const historicalPrices = await fetchHistoricalPrices(priceRequests);

      // 4. Compute PnL using current prices
      const currentPrices = priceMap ?? new Map();
      const tokens = computeTokenPnL(transfers, historicalPrices, currentPrices, address);

      // 5. Aggregate
      const totalUnrealizedPnL = tokens.some((t) => t.unrealizedPnL !== null)
        ? tokens.reduce((s, t) => s + (t.unrealizedPnL ?? 0), 0)
        : null;
      const totalRealizedPnL = tokens.reduce((s, t) => s + t.realizedPnL, 0);
      const totalCurrentValue = tokens.reduce((s, t) => s + (t.currentValueUSD ?? 0), 0);
      const totalCostBasis = tokens.some((t) => t.totalCostUSD !== null)
        ? tokens.reduce((s, t) => s + (t.totalCostUSD ?? 0), 0)
        : null;

      return {
        tokens,
        totalUnrealizedPnL,
        totalRealizedPnL,
        totalCurrentValue,
        totalCostBasis,
        tokensWithHistory: tokens.filter((t) => t.hasPriceHistory).length,
        tokensWithoutHistory: tokens.filter((t) => !t.hasPriceHistory).length,
      };
    },
    enabled: !!address,
    staleTime: 5 * 60 * 1000,   // 5 min — tx history doesn't change fast
    refetchOnWindowFocus: false,
  });
}

function emptyResult(): PnLResult {
  return {
    tokens: [],
    totalUnrealizedPnL: null,
    totalRealizedPnL: 0,
    totalCurrentValue: 0,
    totalCostBasis: null,
    tokensWithHistory: 0,
    tokensWithoutHistory: 0,
  };
}

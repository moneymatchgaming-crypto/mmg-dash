"use client";

import { useCallback } from "react";
import { RefreshCw, Wallet } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useWalletInfo } from "@/lib/web3/hooks/useWalletInfo";
import { useTokenBalances, useNativeBalance } from "@/lib/web3/hooks/useTokenBalances";
import { useLPPositions } from "@/lib/web3/hooks/useLPPositions";
import { usePrices } from "@/lib/web3/hooks/usePrices";
import { Button } from "@/components/ui/button";
import { StatsSummary } from "./components/StatsSummary";
import { TokenBalancesTable } from "./components/TokenBalancesTable";
import { LPPositionsTable } from "./components/LPPositionsTable";
import { ETH_NATIVE_KEY } from "@/lib/pnl/constants";
import type { PnLSummary, TokenHolding, UniV3PositionWithValue } from "@/lib/pnl/types";

export default function PnLTracker() {
  const { address, isConnected, displayAddress } = useWalletInfo();
  const queryClient = useQueryClient();

  // ── Data hooks ────────────────────────────────────────────────────────────
  const { balances, isLoading: balancesLoading, contractAddresses } = useTokenBalances(address);
  const { balanceFormatted: ethBalance, isLoading: ethLoading, priceKey } = useNativeBalance(address);
  const { positions, isLoading: lpLoading, tokenAddresses: lpTokenAddresses } = useLPPositions(address);

  // Collect all unique token addresses for price fetching
  const allTokenAddresses = [...new Set([...contractAddresses, ...lpTokenAddresses])];
  const { priceMap, isLoading: pricesLoading } = usePrices(allTokenAddresses);

  const isLoading = balancesLoading || ethLoading || lpLoading || pricesLoading;

  // ── Enrich token holdings with prices ────────────────────────────────────
  const holdings: TokenHolding[] = balances.map((b) => {
    const p = priceMap.get(b.contractAddress.toLowerCase()) ?? null;
    return {
      ...b,
      price: p,
      valueUSD: p ? b.balanceFormatted * p.priceUSD : null,
    };
  });

  // ── Enrich LP positions with prices ──────────────────────────────────────
  const enrichedPositions: UniV3PositionWithValue[] = positions.map((pos) => {
    const p0 = priceMap.get(pos.token0.toLowerCase()) ?? null;
    const p1 = priceMap.get(pos.token1.toLowerCase()) ?? null;
    const totalValueUSD =
      p0 && p1
        ? pos.amount0 * p0.priceUSD + pos.amount1 * p1.priceUSD
        : p0
        ? pos.amount0 * p0.priceUSD
        : p1
        ? pos.amount1 * p1.priceUSD
        : null;

    return {
      ...pos,
      token0PriceUSD: p0?.priceUSD ?? null,
      token1PriceUSD: p1?.priceUSD ?? null,
      totalValueUSD,
    };
  });

  // ── Compute summary ───────────────────────────────────────────────────────
  const ethPrice = priceMap.get(ETH_NATIVE_KEY);
  const nativeETHValueUSD = ethPrice ? ethBalance * ethPrice.priceUSD : 0;
  const tokenPortfolioUSD = holdings.reduce((s, h) => s + (h.valueUSD ?? 0), 0);
  const lpPositionsUSD = enrichedPositions.reduce(
    (s, p) => s + (p.totalValueUSD ?? 0),
    0
  );

  const summary: PnLSummary = {
    totalValueUSD: tokenPortfolioUSD + lpPositionsUSD + nativeETHValueUSD,
    tokenPortfolioUSD,
    lpPositionsUSD,
    nativeETHValueUSD,
    openLPCount: enrichedPositions.filter((p) => !p.isClosed).length,
  };

  // ── Refresh handler ───────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["tokenBalances"] });
    queryClient.invalidateQueries({ queryKey: ["lpPositions"] });
    queryClient.invalidateQueries({ queryKey: ["prices"] });
  }, [queryClient]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            PnL Tracker
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {isConnected
              ? `Portfolio for ${displayAddress} · Base`
              : "Track your wallet holdings and LP positions"}
          </p>
        </div>
        {isConnected && (
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        )}
      </div>

      {/* Not connected */}
      {!isConnected ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <p className="text-foreground font-medium">No wallet connected</p>
          <p className="text-sm text-muted-foreground mt-1">
            Connect your wallet from the header to view your portfolio
          </p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <StatsSummary summary={isLoading ? null : summary} loading={isLoading} />

          {/* Token Holdings */}
          <TokenBalancesTable
            holdings={holdings}
            nativeETH={isConnected ? { balanceFormatted: ethBalance } : null}
            priceMap={priceMap}
            isLoading={balancesLoading || pricesLoading}
          />

          {/* LP Positions */}
          <LPPositionsTable
            positions={enrichedPositions}
            isLoading={lpLoading || pricesLoading}
          />
        </>
      )}
    </div>
  );
}

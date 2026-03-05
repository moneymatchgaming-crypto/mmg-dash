"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { ETH_NATIVE_KEY, STALE_TIMES } from "@/lib/pnl/constants";
import { fetchCovalentPortfolio, type CovalentPortfolioData } from "@/lib/pnl/covalent";
import type { PnLSummary, TokenHolding, UniV3PositionWithValue, PriceMap } from "@/lib/pnl/types";

// Detect at module init (not inside render) so it's stable
const HAS_COVALENT = !!process.env.NEXT_PUBLIC_COVALENT_API_KEY;

export default function Portfolio() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, isConnected, displayAddress } = useWalletInfo();
  const queryClient = useQueryClient();

  // ── Covalent path: one call = balances + native ETH + prices ─────────────
  const { data: covalentData, isPending: covalentLoading } = useQuery<CovalentPortfolioData>({
    queryKey: ["covalentPortfolio", address],
    queryFn: () => fetchCovalentPortfolio(address!),
    enabled: HAS_COVALENT && !!address,
    staleTime: STALE_TIMES.BALANCES,
    refetchInterval: STALE_TIMES.BALANCES,
  });

  // ── Alchemy fallback path (used only when no Covalent key) ───────────────
  const { balances: alchemyBalances, isLoading: alchemyLoading, contractAddresses: alchemyAddresses } =
    useTokenBalances(!HAS_COVALENT ? address : undefined);
  const { balanceFormatted: alchemyETH, isLoading: alchemyETHLoading } =
    useNativeBalance(!HAS_COVALENT ? address : undefined);

  // ── LP positions: always fetched (Covalent doesn't cover LP) ─────────────
  const { positions, isLoading: lpLoading, tokenAddresses: lpTokenAddresses } =
    useLPPositions(address);

  // ── Price fetching ────────────────────────────────────────────────────────
  // Covalent path: only LP tokens that Covalent didn't price need extra fetching.
  // Alchemy path:  all wallet + LP addresses need pricing.
  const extraPriceAddresses = useMemo(() => {
    if (HAS_COVALENT) {
      if (!covalentData) return []; // wait for Covalent before firing price requests
      const priced = covalentData.priceMap;
      const missing = lpTokenAddresses.filter((a) => !priced.has(a.toLowerCase()));
      return missing.length > 0 ? [ETH_NATIVE_KEY, ...missing] : [];
    }
    return [...new Set([...alchemyAddresses, ...lpTokenAddresses, ETH_NATIVE_KEY])];
  }, [covalentData, lpTokenAddresses, alchemyAddresses]);

  const { priceMap: extraPrices, isLoading: extraPricesLoading } = usePrices(
    extraPriceAddresses,
    { enabled: HAS_COVALENT ? !!covalentData : true }
  );

  // ── Merge price maps ──────────────────────────────────────────────────────
  const priceMap: PriceMap = useMemo(() => {
    if (HAS_COVALENT && covalentData?.priceMap) {
      // Covalent prices take priority; extraPrices fills in any LP-only tokens
      return new Map([...extraPrices, ...covalentData.priceMap]);
    }
    return extraPrices;
  }, [covalentData?.priceMap, extraPrices]);

  // ── Unified values ────────────────────────────────────────────────────────
  const balances     = HAS_COVALENT ? (covalentData?.balances ?? []) : alchemyBalances;
  const ethBalance   = HAS_COVALENT ? (covalentData?.nativeETH?.balanceFormatted ?? 0) : alchemyETH;
  const nativeETHObj = HAS_COVALENT ? covalentData?.nativeETH ?? null : { balanceFormatted: alchemyETH };

  const isLoading = HAS_COVALENT
    ? covalentLoading || lpLoading
    : alchemyLoading || alchemyETHLoading || lpLoading || extraPricesLoading;

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

  const unpricedCount = holdings.filter((h) => h.price === null).length;

  // ── Refresh handler ───────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    if (HAS_COVALENT) {
      queryClient.invalidateQueries({ queryKey: ["covalentPortfolio"] });
    } else {
      queryClient.invalidateQueries({ queryKey: ["tokenBalances"] });
      queryClient.invalidateQueries({ queryKey: ["prices"] });
    }
    queryClient.invalidateQueries({ queryKey: ["lpPositions"] });
  }, [queryClient]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Portfolio
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {mounted && isConnected
              ? `Holdings for ${displayAddress} · Base`
              : "Track your wallet holdings and LP positions"}
          </p>
        </div>
        {mounted && isConnected && (
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        )}
      </div>

      {/* Not connected */}
      {!mounted || !isConnected ? (
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
          <StatsSummary
            summary={isLoading ? null : summary}
            loading={isLoading}
            unpricedCount={unpricedCount}
          />

          {/* Token Holdings */}
          <TokenBalancesTable
            holdings={holdings}
            nativeETH={mounted && isConnected ? nativeETHObj : null}
            priceMap={priceMap}
            isLoading={isLoading}
          />

          {/* LP Positions */}
          <LPPositionsTable
            positions={enrichedPositions}
            isLoading={lpLoading}
          />
        </>
      )}
    </div>
  );
}

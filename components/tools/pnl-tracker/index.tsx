"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown, Wallet, Clock, AlertCircle } from "lucide-react";
import { useWalletInfo } from "@/lib/web3/hooks/useWalletInfo";
import { useTokenBalances } from "@/lib/web3/hooks/useTokenBalances";
import { useLPPositions } from "@/lib/web3/hooks/useLPPositions";
import { usePrices } from "@/lib/web3/hooks/usePrices";
import { usePnL } from "@/lib/web3/hooks/usePnL";
import { ETH_NATIVE_KEY } from "@/lib/pnl/constants";
import { cn, formatUSD, formatPercent } from "@/lib/utils";

function PnLBadge({ value, pct }: { value: number | null; pct?: number | null }) {
  if (value === null) return <span className="text-muted-foreground text-xs">—</span>;
  const positive = value >= 0;
  return (
    <div className={cn("flex items-center gap-1", positive ? "text-emerald-500" : "text-red-500")}>
      {positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      <span className="font-mono font-medium">{positive ? "+" : ""}{formatUSD(value)}</span>
      {pct !== undefined && pct !== null && (
        <span className="text-xs opacity-75">({formatPercent(pct)})</span>
      )}
    </div>
  );
}

function SummaryCard({ title, children, loading }: { title: string; children: React.ReactNode; loading?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground mb-1">{title}</p>
      {loading ? (
        <div className="h-8 w-32 rounded bg-muted/40 animate-pulse" />
      ) : children}
    </div>
  );
}

export default function PnLTracker() {
  const { address, isConnected, displayAddress } = useWalletInfo();

  // Get current portfolio data (same as Portfolio tool) for current prices
  const { contractAddresses } = useTokenBalances(address);
  const { tokenAddresses: lpTokenAddresses } = useLPPositions(address);
  const allTokenAddresses = useMemo(
    () => [...new Set([...contractAddresses, ...lpTokenAddresses, ETH_NATIVE_KEY])],
    [contractAddresses, lpTokenAddresses]
  );
  const { priceMap, isLoading: pricesLoading } = usePrices(allTokenAddresses);

  // PnL computation (heavy — runs once, cached 5min)
  const { data: pnl, isLoading: pnlLoading, error: pnlError } = usePnL(address, priceMap);

  const isLoading = pnlLoading || pricesLoading;

  if (!isConnected) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">PnL Tracker</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">True profit & loss with cost basis from transaction history</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <p className="text-foreground font-medium">No wallet connected</p>
          <p className="text-sm text-muted-foreground mt-1">Connect your wallet to compute P&L</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">PnL Tracker</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {displayAddress} · Base · Average cost basis method
        </p>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Clock className="w-8 h-8 mx-auto mb-3 text-primary animate-pulse" />
          <p className="text-foreground font-medium">Computing your P&L…</p>
          <p className="text-sm text-muted-foreground mt-1">
            Fetching transaction history and historical prices. This may take 15–30 seconds.
          </p>
        </div>
      )}

      {/* Error state */}
      {pnlError && !isLoading && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-3 text-red-500" />
          <p className="text-foreground font-medium">Failed to compute P&L</p>
          <p className="text-sm text-muted-foreground mt-1">{(pnlError as Error).message}</p>
        </div>
      )}

      {/* Results */}
      {pnl && !isLoading && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard title="Unrealized P&L">
              <PnLBadge value={pnl.totalUnrealizedPnL} />
            </SummaryCard>
            <SummaryCard title="Realized P&L">
              <PnLBadge value={pnl.totalRealizedPnL} />
            </SummaryCard>
            <SummaryCard title="Total P&L">
              <PnLBadge
                value={
                  pnl.totalUnrealizedPnL !== null
                    ? pnl.totalUnrealizedPnL + pnl.totalRealizedPnL
                    : null
                }
              />
            </SummaryCard>
            <SummaryCard title="Cost Basis">
              <p className="text-2xl font-bold font-mono text-foreground">
                {pnl.totalCostBasis !== null ? formatUSD(pnl.totalCostBasis) : "—"}
              </p>
            </SummaryCard>
          </div>

          {/* Coverage note */}
          {pnl.tokensWithoutHistory > 0 && (
            <div className="flex items-start gap-2 text-sm text-amber-500/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                {pnl.tokensWithoutHistory} token{pnl.tokensWithoutHistory > 1 ? "s" : ""} had no price history available — cost basis shown as <strong>—</strong> for those.
              </span>
            </div>
          )}

          {/* Per-token table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">Token P&L</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border/50">
                    <th className="px-4 py-2.5 text-left font-medium">Token</th>
                    <th className="px-4 py-2.5 text-right font-medium">Holdings</th>
                    <th className="px-4 py-2.5 text-right font-medium">Avg Buy Price</th>
                    <th className="px-4 py-2.5 text-right font-medium">Current Price</th>
                    <th className="px-4 py-2.5 text-right font-medium">Cost Basis</th>
                    <th className="px-4 py-2.5 text-right font-medium">Current Value</th>
                    <th className="px-4 py-2.5 text-right font-medium">Unrealized P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {pnl.tokens.map((t) => (
                    <tr
                      key={t.contractAddress}
                      className="border-b border-border/50 hover:bg-accent/20 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                            {t.symbol.slice(0, 2)}
                          </div>
                          <span className="text-sm font-medium text-foreground">{t.symbol}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-foreground">
                        {t.currentAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-muted-foreground">
                        {t.avgCostBasisUSD !== null ? formatUSD(t.avgCostBasisUSD) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-foreground">
                        {t.currentPriceUSD !== null ? formatUSD(t.currentPriceUSD) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-muted-foreground">
                        {t.totalCostUSD !== null ? formatUSD(t.totalCostUSD) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-medium text-foreground">
                        {t.currentValueUSD !== null ? formatUSD(t.currentValueUSD) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PnLBadge value={t.unrealizedPnL} pct={t.unrealizedPnLPct} />
                      </td>
                    </tr>
                  ))}
                  {pnl.tokens.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No transfer history found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

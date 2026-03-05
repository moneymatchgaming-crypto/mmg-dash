import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn, formatUSD, formatPercent } from "@/lib/utils";
import type { PnLSummary } from "@/lib/pnl/types";

function StatCard({
  title,
  value,
  subtitle,
  change,
  loading,
}: {
  title: string;
  value: string;
  subtitle?: string;
  change?: number | null;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{title}</p>

      {loading ? (
        <div className="h-8 w-32 mt-1 rounded bg-muted/40 animate-pulse" />
      ) : (
        <p className="text-2xl font-bold mt-1 text-foreground tracking-tight font-mono">
          {value}
        </p>
      )}

      {change !== undefined && change !== null && !loading && (
        <div
          className={cn(
            "flex items-center gap-1 text-sm mt-1.5",
            change > 0 ? "text-emerald-500" : change < 0 ? "text-red-500" : "text-muted-foreground"
          )}
        >
          {change > 0 ? (
            <TrendingUp className="w-3.5 h-3.5" />
          ) : change < 0 ? (
            <TrendingDown className="w-3.5 h-3.5" />
          ) : (
            <Minus className="w-3.5 h-3.5" />
          )}
          <span>{formatPercent(change)}</span>
        </div>
      )}

      {subtitle && !loading && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}
    </div>
  );
}

export function StatsSummary({
  summary,
  loading,
}: {
  summary: PnLSummary | null;
  loading: boolean;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Total Portfolio"
        value={summary ? formatUSD(summary.totalValueUSD) : "$0.00"}
        subtitle="Tokens + LP + ETH"
        loading={loading}
      />
      <StatCard
        title="Token Holdings"
        value={summary ? formatUSD(summary.tokenPortfolioUSD + summary.nativeETHValueUSD) : "$0.00"}
        subtitle="ERC-20 + native ETH"
        loading={loading}
      />
      <StatCard
        title="LP Positions"
        value={summary ? formatUSD(summary.lpPositionsUSD) : "$0.00"}
        subtitle="Uniswap v3 on Base"
        loading={loading}
      />
      <StatCard
        title="Open LP Count"
        value={summary ? String(summary.openLPCount) : "—"}
        subtitle="Active positions"
        loading={loading}
      />
    </div>
  );
}

"use client";

import { TrendingUp, TrendingDown, RefreshCw, Wallet } from "lucide-react";
import { useWalletInfo } from "@/lib/web3/hooks/useWalletInfo";
import { Button } from "@/components/ui/button";
import { cn, formatUSD, formatPercent } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  change?: number;
  subtitle?: string;
}

function StatCard({ title, value, change, subtitle }: StatCardProps) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-2xl font-bold mt-1 text-foreground tracking-tight">
        {value}
      </p>
      {change !== undefined && (
        <div
          className={cn(
            "flex items-center gap-1 text-sm mt-1.5",
            isPositive ? "text-emerald-500" : "text-red-500"
          )}
        >
          {isPositive ? (
            <TrendingUp className="w-3.5 h-3.5" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5" />
          )}
          <span>{formatPercent(change)}</span>
        </div>
      )}
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}
    </div>
  );
}

export default function PnLTracker() {
  const { isConnected, displayAddress } = useWalletInfo();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            PnL Tracker
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Track your on-chain profit and loss across positions
          </p>
        </div>
        {isConnected && (
          <Button variant="outline" size="sm">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </Button>
        )}
      </div>

      {!isConnected ? (
        /* Empty state */
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <p className="text-foreground font-medium">No wallet connected</p>
          <p className="text-sm text-muted-foreground mt-1">
            Connect your wallet from the header to start tracking positions
          </p>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Total PnL"
              value={formatUSD(0)}
              change={0}
              subtitle="All time"
            />
            <StatCard
              title="Realized PnL"
              value={formatUSD(0)}
              change={0}
              subtitle="Closed positions"
            />
            <StatCard
              title="Unrealized PnL"
              value={formatUSD(0)}
              change={0}
              subtitle="Open positions"
            />
          </div>

          {/* Positions table placeholder */}
          <div className="rounded-xl border border-border bg-card">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Positions</h2>
              <span className="text-xs text-muted-foreground font-mono">
                {displayAddress}
              </span>
            </div>
            <div className="p-8 text-center text-muted-foreground text-sm">
              <TrendingUp className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p>No open positions found</p>
              <p className="text-xs mt-1 opacity-70">
                Position data will appear here once integrated
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

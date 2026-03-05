"use client";

import { useState } from "react";
import { ExternalLink, ChevronDown, Layers } from "lucide-react";
import { cn, formatUSD } from "@/lib/utils";
import { FEE_TIER_LABELS } from "@/lib/pnl/constants";
import type { UniV3PositionWithValue } from "@/lib/pnl/types";

function StatusBadge({ pos }: { pos: UniV3PositionWithValue }) {
  if (pos.isClosed) {
    return (
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wide">
        Closed
      </span>
    );
  }
  return pos.isInRange ? (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500 uppercase tracking-wide">
      In Range
    </span>
  ) : (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-500 uppercase tracking-wide">
      Out of Range
    </span>
  );
}

function PositionRow({ pos }: { pos: UniV3PositionWithValue }) {
  const [expanded, setExpanded] = useState(false);

  const feesValue =
    (pos.uncollectedFees0 * (pos.token0PriceUSD ?? 0)) +
    (pos.uncollectedFees1 * (pos.token1PriceUSD ?? 0));

  return (
    <>
      <tr
        className="border-b border-border/50 hover:bg-accent/20 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Pair */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-foreground">
              {pos.token0Symbol}/{pos.token1Symbol}
            </span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent text-muted-foreground">
              {FEE_TIER_LABELS[pos.fee] ?? `${pos.fee / 10000}%`}
            </span>
          </div>
        </td>

        {/* Amounts */}
        <td className="px-4 py-3 text-sm text-right">
          {pos.isClosed ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <div className="text-foreground font-mono space-y-0.5">
              <div>{pos.amount0.toLocaleString(undefined, { maximumFractionDigits: 6 })} {pos.token0Symbol}</div>
              <div>{pos.amount1.toLocaleString(undefined, { maximumFractionDigits: 6 })} {pos.token1Symbol}</div>
            </div>
          )}
        </td>

        {/* Uncollected fees */}
        <td className="px-4 py-3 text-sm text-right">
          {(pos.uncollectedFees0 > 0 || pos.uncollectedFees1 > 0) ? (
            <div className="text-emerald-500 font-mono space-y-0.5">
              {pos.uncollectedFees0 > 0 && (
                <div>{pos.uncollectedFees0.toLocaleString(undefined, { maximumFractionDigits: 6 })} {pos.token0Symbol}</div>
              )}
              {pos.uncollectedFees1 > 0 && (
                <div>{pos.uncollectedFees1.toLocaleString(undefined, { maximumFractionDigits: 6 })} {pos.token1Symbol}</div>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>

        {/* Total value */}
        <td className="px-4 py-3 text-right font-mono text-sm font-medium text-foreground">
          {pos.totalValueUSD !== null ? formatUSD(pos.totalValueUSD + feesValue) : "—"}
        </td>

        {/* Status */}
        <td className="px-4 py-3 text-right">
          <StatusBadge pos={pos} />
        </td>

        {/* Expand */}
        <td className="px-4 py-3 text-right">
          <ChevronDown
            className={cn("w-4 h-4 text-muted-foreground transition-transform ml-auto", expanded && "rotate-180")}
          />
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-border/50 bg-accent/10">
          <td colSpan={6} className="px-6 py-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-muted-foreground">
              <div>
                <p className="font-medium text-foreground/60 mb-0.5">Token ID</p>
                <p className="font-mono">#{pos.tokenId.toString()}</p>
              </div>
              <div>
                <p className="font-medium text-foreground/60 mb-0.5">Tick Range</p>
                <p className="font-mono">{pos.tickLower} → {pos.tickUpper}</p>
              </div>
              <div>
                <p className="font-medium text-foreground/60 mb-0.5">Current Tick</p>
                <p className="font-mono">{pos.currentTick ?? "—"}</p>
              </div>
              {pos.poolAddress && (
                <div>
                  <p className="font-medium text-foreground/60 mb-0.5">Pool</p>
                  <a
                    href={`https://app.uniswap.org/explore/pools/base/${pos.poolAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="font-mono text-primary flex items-center gap-1 hover:underline"
                  >
                    {pos.poolAddress.slice(0, 8)}…{pos.poolAddress.slice(-6)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function LPPositionsTable({
  positions,
  isLoading,
}: {
  positions: UniV3PositionWithValue[];
  isLoading: boolean;
}) {
  const [showClosed, setShowClosed] = useState(false);

  const open   = positions.filter((p) => !p.isClosed);
  const closed = positions.filter((p) => p.isClosed);
  const displayed = showClosed ? positions : open;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <div className="h-5 w-36 rounded bg-muted/40 animate-pulse" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="px-5 py-4 border-b border-border/50 flex items-center gap-4">
            <div className="flex-1 h-4 rounded bg-muted/40 animate-pulse" />
            <div className="w-24 h-4 rounded bg-muted/40 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <Layers className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-30" />
        <p className="text-sm text-muted-foreground">No Uniswap v3 LP positions found on Base</p>
        <p className="text-xs text-muted-foreground mt-1 opacity-70">
          Aerodrome and other AMMs coming soon
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold text-foreground">LP Positions</h2>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{open.length} open</span>
          {closed.length > 0 && (
            <button
              onClick={() => setShowClosed(!showClosed)}
              className="hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <ChevronDown className={cn("w-3 h-3 transition-transform", showClosed && "rotate-180")} />
              {showClosed ? "Hide" : `Show ${closed.length}`} closed
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-muted-foreground border-b border-border/50">
              <th className="px-4 py-2.5 text-left font-medium">Pair</th>
              <th className="px-4 py-2.5 text-right font-medium">Amounts</th>
              <th className="px-4 py-2.5 text-right font-medium">Uncollected Fees</th>
              <th className="px-4 py-2.5 text-right font-medium">Value</th>
              <th className="px-4 py-2.5 text-right font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium w-8" />
            </tr>
          </thead>
          <tbody>
            {displayed.map((pos) => (
              <PositionRow key={pos.tokenId.toString()} pos={pos} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

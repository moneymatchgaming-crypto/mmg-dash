"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, Coins } from "lucide-react";
import { cn, formatUSD, formatPercent } from "@/lib/utils";
import { DUST_THRESHOLD_USD, ETH_NATIVE_KEY } from "@/lib/pnl/constants";
import type { TokenHolding, PriceMap } from "@/lib/pnl/types";

interface NativeETHRow {
  balanceFormatted: number;
  priceMap: PriceMap;
}

import type { PriceSource } from "@/lib/pnl/types";

function PriceSourceDot({ source }: { source: PriceSource | undefined }) {
  if (!source) return null;
  const colors: Record<string, string> = {
    coingecko:  "bg-emerald-500",
    defillama:  "bg-blue-500",
    dexscreener:"bg-orange-500",
  };
  const labels: Record<string, string> = {
    coingecko:  "CoinGecko",
    defillama:  "DefiLlama",
    dexscreener:"DexScreener",
  };
  return (
    <span
      title={labels[source] ?? source}
      className={cn("inline-block w-1.5 h-1.5 rounded-full", colors[source] ?? "bg-muted")}
    />
  );
}

function TokenRow({
  symbol,
  name,
  logoURI,
  balance,
  price,
  value,
  change24h,
  priceSource,
}: {
  symbol: string;
  name: string;
  logoURI?: string;
  balance: number;
  price: number | null;
  value: number | null;
  change24h: number | null;
  priceSource?: PriceSource;
}) {
  return (
    <tr className="border-b border-border/50 hover:bg-accent/20 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          {logoURI ? (
            <Image
              src={logoURI}
              alt={symbol}
              width={24}
              height={24}
              className="rounded-full"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
              {symbol.slice(0, 2)}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-foreground">{symbol}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[120px]">{name}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right font-mono text-sm text-foreground">
        {balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}
      </td>
      <td className="px-4 py-3 text-right text-sm">
        <div className="flex items-center justify-end gap-1.5">
          <PriceSourceDot source={priceSource} />
          {price !== null ? (
            <span className="text-foreground font-mono">{formatUSD(price)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right text-sm">
        {change24h !== null ? (
          <span className={cn(
            "font-mono",
            change24h > 0 ? "text-emerald-500" : change24h < 0 ? "text-red-500" : "text-muted-foreground"
          )}>
            {formatPercent(change24h)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right font-mono text-sm font-medium text-foreground">
        {value !== null ? formatUSD(value) : "—"}
      </td>
    </tr>
  );
}

export function TokenBalancesTable({
  holdings,
  nativeETH,
  priceMap,
  isLoading,
}: {
  holdings: TokenHolding[];
  nativeETH: { balanceFormatted: number } | null;
  priceMap: PriceMap;
  isLoading: boolean;
}) {
  const [showDust, setShowDust] = useState(false);

  const ethPrice = priceMap.get(ETH_NATIVE_KEY);
  const ethValue = ethPrice && nativeETH ? nativeETH.balanceFormatted * ethPrice.priceUSD : null;

  const allHoldings = holdings.filter((h) => h.balanceFormatted > 0);
  const mainHoldings = allHoldings.filter((h) => (h.valueUSD ?? 0) >= DUST_THRESHOLD_USD);
  const dustHoldings = allHoldings.filter((h) => (h.valueUSD ?? 0) < DUST_THRESHOLD_USD);

  const displayed = showDust ? allHoldings : mainHoldings;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <div className="h-5 w-36 rounded bg-muted/40 animate-pulse" />
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="px-5 py-3 border-b border-border/50 flex items-center gap-4">
            <div className="w-6 h-6 rounded-full bg-muted/40 animate-pulse" />
            <div className="flex-1 h-4 rounded bg-muted/40 animate-pulse" />
            <div className="w-20 h-4 rounded bg-muted/40 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (!nativeETH?.balanceFormatted && holdings.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <Coins className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-30" />
        <p className="text-sm text-muted-foreground">No token holdings found</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Token Holdings</h2>
        {dustHoldings.length > 0 && (
          <button
            onClick={() => setShowDust(!showDust)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <ChevronDown className={cn("w-3 h-3 transition-transform", showDust && "rotate-180")} />
            {showDust ? "Hide" : `Show ${dustHoldings.length}`} dust
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-muted-foreground border-b border-border/50">
              <th className="px-4 py-2.5 text-left font-medium">Token</th>
              <th className="px-4 py-2.5 text-right font-medium">Balance</th>
              <th className="px-4 py-2.5 text-right font-medium">Price</th>
              <th className="px-4 py-2.5 text-right font-medium">24h</th>
              <th className="px-4 py-2.5 text-right font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {/* Native ETH — always first */}
            {(nativeETH?.balanceFormatted ?? 0) > 0 && (
              <TokenRow
                symbol="ETH"
                name="Ether (native)"
                balance={nativeETH!.balanceFormatted}
                price={ethPrice?.priceUSD ?? null}
                value={ethValue}
                change24h={ethPrice?.change24hPct ?? null}
                priceSource={ethPrice?.source}
              />
            )}
            {/* ERC-20 holdings sorted by value */}
            {displayed
              .sort((a, b) => (b.valueUSD ?? 0) - (a.valueUSD ?? 0))
              .map((h) => (
                <TokenRow
                  key={h.contractAddress}
                  symbol={h.symbol}
                  name={h.name}
                  logoURI={h.logoURI}
                  balance={h.balanceFormatted}
                  price={h.price?.priceUSD ?? null}
                  value={h.valueUSD}
                  change24h={h.price?.change24hPct ?? null}
                  priceSource={h.price?.source}
                />
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

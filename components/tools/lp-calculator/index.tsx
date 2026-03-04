"use client";

import { useState } from "react";
import { Calculator, AlertTriangle, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatPercent } from "@/lib/utils";

interface CalculationResult {
  ilPercent: number;
  hodlValue: number;
  lpValue: number;
  feesNeeded: number;
}

/** Impermanent Loss formula: IL = 2 * sqrt(priceRatio) / (1 + priceRatio) - 1 */
function calcImpermanentLoss(
  initialPrice: number,
  currentPrice: number
): CalculationResult {
  const ratio = currentPrice / initialPrice;
  const il = (2 * Math.sqrt(ratio)) / (1 + ratio) - 1;
  const hodlValue = 100 * (1 + ratio) / 2; // normalized to $100 entry
  const lpValue = hodlValue * (1 + il);
  const feesNeeded = hodlValue - lpValue;

  return {
    ilPercent: il * 100,
    hodlValue,
    lpValue,
    feesNeeded,
  };
}

function ResultRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "positive" | "negative" | "neutral";
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-sm font-medium",
          highlight === "negative" && "text-red-500",
          highlight === "positive" && "text-emerald-500",
          highlight === "neutral" && "text-foreground",
          !highlight && "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export default function LPCalculator() {
  const [initialPrice, setInitialPrice] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [result, setResult] = useState<CalculationResult | null>(null);

  const handleCalculate = () => {
    const initial = parseFloat(initialPrice);
    const current = parseFloat(currentPrice);
    if (!initial || !current || initial <= 0 || current <= 0) return;
    setResult(calcImpermanentLoss(initial, current));
  };

  const inputClass =
    "w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          LP Calculator
        </h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Calculate impermanent loss for Uniswap v2-style LP positions
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Input panel */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <h2 className="font-semibold text-foreground">Price Inputs</h2>

          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">
              Token price when you entered the LP ($)
            </label>
            <input
              type="number"
              placeholder="e.g. 100"
              value={initialPrice}
              onChange={(e) => setInitialPrice(e.target.value)}
              className={inputClass}
              min="0"
              step="any"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">
              Current token price ($)
            </label>
            <input
              type="number"
              placeholder="e.g. 150"
              value={currentPrice}
              onChange={(e) => setCurrentPrice(e.target.value)}
              className={inputClass}
              min="0"
              step="any"
            />
          </div>

          <Button onClick={handleCalculate} className="w-full">
            <Calculator className="w-4 h-4 mr-2" />
            Calculate
          </Button>
        </div>

        {/* Result panel */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold text-foreground mb-4">Results</h2>

          {!result ? (
            <div className="flex flex-col items-center justify-center h-36 text-center">
              <Calculator className="w-8 h-8 text-muted-foreground mb-3 opacity-30" />
              <p className="text-sm text-muted-foreground">
                Enter prices and click Calculate
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-border">
                <ResultRow
                  label="Impermanent Loss"
                  value={formatPercent(result.ilPercent)}
                  highlight={result.ilPercent < 0 ? "negative" : "positive"}
                />
                <ResultRow
                  label="HODL value (per $100 entry)"
                  value={`$${result.hodlValue.toFixed(2)}`}
                  highlight="neutral"
                />
                <ResultRow
                  label="LP value (per $100 entry)"
                  value={`$${result.lpValue.toFixed(2)}`}
                  highlight="neutral"
                />
                <ResultRow
                  label="Fees needed to break even"
                  value={`$${result.feesNeeded.toFixed(2)}`}
                  highlight={result.feesNeeded > 0 ? "negative" : "positive"}
                />
              </div>

              {result.ilPercent < -5 && (
                <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    High impermanent loss detected. Ensure fee income exceeds{" "}
                    <strong>${result.feesNeeded.toFixed(2)}</strong> to profit
                    over simply holding.
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Info box */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground text-sm">How IL is calculated</p>
        <p>
          This uses the standard Uniswap v2 constant-product formula:{" "}
          <code className="font-mono text-primary/80">
            IL = 2√(P₁/P₀) / (1 + P₁/P₀) - 1
          </code>
        </p>
        <p>
          Concentrated liquidity (Uniswap v3, Algebra) has a different IL
          profile — a v3 calculator is on the roadmap.
        </p>
      </div>
    </div>
  );
}

/**
 * Transaction history + historical price fetching for PnL computation.
 *
 * Flow:
 *   1. alchemy_getAssetTransfers → all token in/out events
 *   2. DefiLlama batchHistorical → prices at time of each buy
 *   3. Average cost basis computation per token
 */

import { ETH_NATIVE_KEY } from "./constants";

export interface TransferEvent {
  hash: string;
  blockNum: string;
  timestampMs: number;      // Unix ms (from Alchemy metadata)
  from: string;
  to: string;
  contractAddress: string;  // ETH_NATIVE_KEY for native ETH
  symbol: string;
  decimals: number;
  value: number;            // human-readable amount
  direction: "in" | "out";
}

export interface TokenPnL {
  contractAddress: string;  // ETH_NATIVE_KEY for ETH
  symbol: string;
  // Current state
  currentAmount: number;
  currentValueUSD: number | null;
  currentPriceUSD: number | null;
  // Cost basis (average cost method)
  avgCostBasisUSD: number | null;  // per token
  totalCostUSD: number | null;     // avgCost * currentAmount
  // PnL
  unrealizedPnL: number | null;
  unrealizedPnLPct: number | null;
  realizedPnL: number;
  totalPnL: number | null;
  // Meta
  hasPriceHistory: boolean;  // false if we couldn't get historical prices
}

// ─── Alchemy Transfer Fetching ────────────────────────────────────────────────

export async function fetchTransferHistory(
  alchemyUrl: string,
  address: string
): Promise<TransferEvent[]> {
  // Fetch transfers IN (to the wallet)
  const inTransfers = await fetchAlchemyTransfers(alchemyUrl, address, "to");
  // Fetch transfers OUT (from the wallet)
  const outTransfers = await fetchAlchemyTransfers(alchemyUrl, address, "from");

  return [...inTransfers, ...outTransfers];
}

async function fetchAlchemyTransfers(
  url: string,
  address: string,
  direction: "to" | "from"
): Promise<TransferEvent[]> {
  const results: TransferEvent[] = [];
  let pageKey: string | undefined;

  const param = direction === "to" ? "toAddress" : "fromAddress";
  const dir: "in" | "out" = direction === "to" ? "in" : "out";

  do {
    const body = {
      jsonrpc: "2.0",
      id: 1,
      method: "alchemy_getAssetTransfers",
      params: [{
        fromBlock: "0x0",
        toBlock: "latest",
        [param]: address,
        category: ["erc20", "external"],
        withMetadata: true,
        excludeZeroValue: true,
        maxCount: "0x3e8", // 1000
        ...(pageKey ? { pageKey } : {}),
      }],
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) break;
    const data = await res.json() as {
      result?: {
        transfers: Array<{
          hash: string;
          blockNum: string;
          from: string;
          to: string;
          asset: string | null;
          value: number | null;
          rawContract: { address: string | null; decimal: string | null };
          metadata: { blockTimestamp: string };
          category: string;
        }>;
        pageKey?: string;
      };
    };

    if (!data.result) break;

    for (const t of data.result.transfers) {
      if (t.value === null || t.value === 0) continue;

      const contractAddress =
        t.category === "external"
          ? ETH_NATIVE_KEY
          : (t.rawContract.address?.toLowerCase() ?? null);

      if (!contractAddress) continue;

      const decimals = t.rawContract.decimal
        ? parseInt(t.rawContract.decimal, 16)
        : 18;

      results.push({
        hash: t.hash,
        blockNum: t.blockNum,
        timestampMs: new Date(t.metadata.blockTimestamp).getTime(),
        from: t.from.toLowerCase(),
        to: t.to?.toLowerCase() ?? "",
        contractAddress,
        symbol: t.asset ?? "???",
        decimals,
        value: t.value,
        direction: dir,
      });
    }

    pageKey = data.result.pageKey;
  } while (pageKey);

  return results;
}

// ─── Historical Price Fetching ────────────────────────────────────────────────

/**
 * Fetch historical prices for a set of (contractAddress, timestamp) pairs.
 * Uses DefiLlama batchHistorical endpoint.
 * Returns a Map keyed by `${contractAddress}:${dayTs}` where dayTs is the Unix day timestamp.
 */
export async function fetchHistoricalPrices(
  requests: Array<{ contractAddress: string; timestampMs: number }>
): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();
  if (requests.length === 0) return priceMap;

  // Group by (coin, day) to minimize requests
  // DefiLlama uses Unix seconds timestamps
  const coinTimestamps: Record<string, Set<number>> = {};

  for (const req of requests) {
    const coin =
      req.contractAddress === ETH_NATIVE_KEY
        ? "coingecko:ethereum"
        : `base:${req.contractAddress.toLowerCase()}`;
    const dayTs = Math.floor(req.timestampMs / 1000 / 86400) * 86400; // floor to day

    if (!coinTimestamps[coin]) coinTimestamps[coin] = new Set();
    coinTimestamps[coin].add(dayTs);
  }

  // Build batchHistorical request
  // Format: coins={"base:0x...": [ts1, ts2], "coingecko:ethereum": [ts1]}
  const coinsParam: Record<string, number[]> = {};
  for (const [coin, timestamps] of Object.entries(coinTimestamps)) {
    coinsParam[coin] = [...timestamps];
  }

  try {
    const url = `https://coins.llama.fi/batchHistorical?coins=${encodeURIComponent(JSON.stringify(coinsParam))}&searchWidth=86400`;
    const res = await fetch(url);
    if (!res.ok) return priceMap;

    const data = await res.json() as {
      coins: Record<string, {
        prices: Array<{ timestamp: number; price: number }>;
      }>;
    };

    for (const [coin, info] of Object.entries(data.coins)) {
      const contractAddr =
        coin === "coingecko:ethereum"
          ? ETH_NATIVE_KEY
          : coin.replace("base:", "").toLowerCase();

      for (const point of info.prices) {
        const dayTs = Math.floor(point.timestamp / 86400) * 86400;
        priceMap.set(`${contractAddr}:${dayTs}`, point.price);
      }
    }
  } catch {
    // DefiLlama down — return empty, UI will show "no price history"
  }

  return priceMap;
}

// ─── PnL Computation ─────────────────────────────────────────────────────────

/**
 * Compute per-token PnL using average cost basis method.
 *
 * For each token:
 *   - Track running avg cost as buys come in
 *   - On sells: realized PnL = (sell price - avg cost) * qty (best effort — sell price from current prices if no historical)
 *   - Unrealized PnL = (current price - avg cost) * current holding
 */
export function computeTokenPnL(
  transfers: TransferEvent[],
  historicalPrices: Map<string, number>,
  currentPrices: Map<string, { priceUSD: number }>,
  walletAddress: string
): TokenPnL[] {
  // Group transfers by contractAddress
  const byToken = new Map<string, TransferEvent[]>();
  for (const t of transfers) {
    const arr = byToken.get(t.contractAddress) ?? [];
    arr.push(t);
    byToken.set(t.contractAddress, arr);
  }

  const results: TokenPnL[] = [];

  for (const [contractAddress, events] of byToken) {
    // Sort chronologically
    const sorted = [...events].sort((a, b) => a.timestampMs - b.timestampMs);

    let totalBought = 0;
    let totalCostUSD = 0;
    let avgCost = 0;
    let currentAmount = 0;
    let realizedPnL = 0;
    let hasPriceHistory = false;

    const symbol = sorted[0].symbol;

    for (const t of sorted) {
      const dayTs = Math.floor(t.timestampMs / 1000 / 86400) * 86400;
      const historicalPrice = historicalPrices.get(`${contractAddress}:${dayTs}`) ?? null;
      if (historicalPrice !== null) hasPriceHistory = true;

      if (t.direction === "in") {
        // Buy / receive
        const cost = historicalPrice !== null ? t.value * historicalPrice : 0;

        if (historicalPrice !== null) {
          // Update weighted average cost
          const newTotal = totalBought + t.value;
          avgCost = newTotal > 0 ? (totalCostUSD + cost) / newTotal : 0;
          totalCostUSD += cost;
          totalBought += t.value;
        } else {
          // No price history — just track amount, cost basis unknown
          totalBought += t.value;
        }

        currentAmount += t.value;
      } else {
        // Sell / send out
        const sellPrice = historicalPrice ?? currentPrices.get(contractAddress)?.priceUSD ?? null;

        if (sellPrice !== null && avgCost > 0) {
          realizedPnL += (sellPrice - avgCost) * t.value;
        }

        currentAmount = Math.max(0, currentAmount - t.value);
      }
    }

    const currentPriceData = currentPrices.get(contractAddress);
    const currentPriceUSD = currentPriceData?.priceUSD ?? null;
    const currentValueUSD = currentPriceUSD !== null ? currentAmount * currentPriceUSD : null;
    const totalCostOfHoldings = hasPriceHistory ? avgCost * currentAmount : null;

    const unrealizedPnL =
      currentValueUSD !== null && totalCostOfHoldings !== null
        ? currentValueUSD - totalCostOfHoldings
        : null;

    const unrealizedPnLPct =
      unrealizedPnL !== null && totalCostOfHoldings !== null && totalCostOfHoldings > 0
        ? (unrealizedPnL / totalCostOfHoldings) * 100
        : null;

    // Only include tokens with meaningful current holdings or realized PnL
    if (currentAmount < 0.000001 && Math.abs(realizedPnL) < 0.01) continue;

    results.push({
      contractAddress,
      symbol,
      currentAmount,
      currentValueUSD,
      currentPriceUSD,
      avgCostBasisUSD: hasPriceHistory ? avgCost : null,
      totalCostUSD: totalCostOfHoldings,
      unrealizedPnL,
      unrealizedPnLPct,
      realizedPnL,
      totalPnL: unrealizedPnL !== null ? unrealizedPnL + realizedPnL : null,
      hasPriceHistory,
    });
  }

  // Sort by absolute unrealized PnL descending
  return results.sort(
    (a, b) => Math.abs(b.unrealizedPnL ?? 0) - Math.abs(a.unrealizedPnL ?? 0)
  );
}

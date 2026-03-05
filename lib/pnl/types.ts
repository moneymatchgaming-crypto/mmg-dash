import type { Address } from "viem";

// ─── Token / ERC-20 ────────────────────────────────────────────────────────

export interface TokenMetadata {
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

export interface TokenBalance extends TokenMetadata {
  contractAddress: Address;
  rawBalance: bigint;
  balanceFormatted: number;
}

export type PriceSource = "coingecko" | "defillama" | "dexscreener";

export interface TokenPrice {
  priceUSD: number;
  change24hPct: number | null;
  source: PriceSource;
}

/** TokenBalance enriched with live price data */
export interface TokenHolding extends TokenBalance {
  price: TokenPrice | null;
  valueUSD: number | null;
}

// ─── Uniswap v3 LP Positions ────────────────────────────────────────────────

export interface UniV3Position {
  tokenId: bigint;
  token0: Address;
  token1: Address;
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
  /** Fee tier in bips (500 = 0.05%, 3000 = 0.3%, 10000 = 1%) */
  fee: number;
  tickLower: number;
  tickUpper: number;
  currentTick: number | null;
  liquidity: bigint;
  /** Human-readable token amounts currently in position */
  amount0: number;
  amount1: number;
  /** Uncollected fees (from tokensOwed — checkpointed, not real-time) */
  uncollectedFees0: number;
  uncollectedFees1: number;
  isInRange: boolean;
  isClosed: boolean;
  /** Pool address — used for linking to Uniswap UI */
  poolAddress: Address | null;
}

/** UniV3Position enriched with price data */
export interface UniV3PositionWithValue extends UniV3Position {
  token0PriceUSD: number | null;
  token1PriceUSD: number | null;
  totalValueUSD: number | null;
}

// ─── PnL Summary ────────────────────────────────────────────────────────────

export interface PnLSummary {
  totalValueUSD: number;
  tokenPortfolioUSD: number;
  lpPositionsUSD: number;
  nativeETHValueUSD: number;
  openLPCount: number;
}

// ─── Alchemy ────────────────────────────────────────────────────────────────

export interface AlchemyTransfer {
  blockNum: string;
  hash: string;
  from: string;
  to: string;
  value: number | null;
  asset: string | null;
  category: string;
  rawContract: {
    value: string;
    address: string | null;
    decimal: string;
  };
  metadata?: {
    blockTimestamp: string;
  };
}

// ─── Price Map ──────────────────────────────────────────────────────────────

/** address (lowercase) → price info */
export type PriceMap = Map<string, TokenPrice>;

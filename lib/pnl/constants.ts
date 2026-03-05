import type { Address } from "viem";

export const BASE_CHAIN_ID = 8453;

export const ADDRESSES = {
  UNISWAP_V3_POSITION_MANAGER: "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1" as Address,
  UNISWAP_V3_FACTORY:          "0x33128a8fC17869897dcE68Ed026d694621f6FDfD" as Address,
  WETH:                        "0x4200000000000000000000000000000000000006" as Address,
} as const;

/** Sentinel key for native ETH in price maps (not a real contract address) */
export const ETH_NATIVE_KEY = "eth-native" as const;

/** CoinGecko platform slug for Base */
export const COINGECKO_PLATFORM = "base";

export const STALE_TIMES = {
  PRICES:       60_000,   // 1 min
  BALANCES:     30_000,   // 30 s
  LP_POSITIONS: 60_000,   // 1 min
  TX_HISTORY:   300_000,  // 5 min
} as const;

export const MAX_LP_POSITIONS = 50;

/** Minimum USD value to show a token (hides dust) */
export const DUST_THRESHOLD_USD = 0.01;

/** Uniswap v3 fee tier labels */
export const FEE_TIER_LABELS: Record<number, string> = {
  100:   "0.01%",
  500:   "0.05%",
  3000:  "0.3%",
  10000: "1%",
};

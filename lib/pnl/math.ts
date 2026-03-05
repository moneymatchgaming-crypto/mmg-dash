/**
 * Uniswap v3 math — pure BigInt, no floating-point, no SDK dependency.
 *
 * getSqrtRatioAtTick is a direct port of the Solidity TickMath contract using
 * BigInt arithmetic so results are identical to on-chain values.
 */

const Q32  = 2n ** 32n;
const Q96  = 2n ** 96n;
const Q128 = 2n ** 128n;

// Maximum uint256 — used for safe wrapping subtraction
const UINT256_MAX = 2n ** 256n;

// ─── Tick Math ──────────────────────────────────────────────────────────────

/**
 * Direct port of Uniswap v3 TickMath.getSqrtRatioAtTick (Solidity → BigInt).
 * Returns sqrtPriceX96 as a bigint (Q64.96 fixed-point).
 */
export function getSqrtRatioAtTick(tick: number): bigint {
  const absTick = BigInt(Math.abs(tick));

  let ratio =
    absTick & 0x1n
      ? 0xfffcb933bd6fad37aa2d162d1a594001n
      : 0x100000000000000000000000000000000n;

  if (absTick & 0x2n)     ratio = (ratio * 0xfff97272373d413259a46990580e213an) >> 128n;
  if (absTick & 0x4n)     ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n;
  if (absTick & 0x8n)     ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n;
  if (absTick & 0x10n)    ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) >> 128n;
  if (absTick & 0x20n)    ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n;
  if (absTick & 0x40n)    ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861n) >> 128n;
  if (absTick & 0x80n)    ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053n) >> 128n;
  if (absTick & 0x100n)   ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4n) >> 128n;
  if (absTick & 0x200n)   ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54n) >> 128n;
  if (absTick & 0x400n)   ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3n) >> 128n;
  if (absTick & 0x800n)   ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9n) >> 128n;
  if (absTick & 0x1000n)  ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825n) >> 128n;
  if (absTick & 0x2000n)  ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5n) >> 128n;
  if (absTick & 0x4000n)  ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7n) >> 128n;
  if (absTick & 0x8000n)  ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6n) >> 128n;
  if (absTick & 0x10000n) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9n) >> 128n;
  if (absTick & 0x20000n) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604n) >> 128n;
  if (absTick & 0x40000n) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98n) >> 128n;
  if (absTick & 0x80000n) ratio = (ratio * 0x48a170391f7dc42444e8fa2n) >> 128n;

  if (tick > 0) ratio = UINT256_MAX / ratio;

  // Convert from Q128.128 → Q64.96 (divide by 2^32, round up)
  const sqrtPriceX96 = ratio / Q32 + (ratio % Q32 === 0n ? 0n : 1n);
  return sqrtPriceX96;
}

// ─── Amount Calculations ─────────────────────────────────────────────────────

/**
 * Amount of token0 provided by liquidity between two sqrt prices.
 * Corresponds to LiquidityMath.calcAmount0Delta in Uniswap v3.
 */
function amount0Delta(
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  liquidity: bigint
): bigint {
  if (sqrtRatioAX96 > sqrtRatioBX96)
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  return (liquidity * Q96 * (sqrtRatioBX96 - sqrtRatioAX96)) /
    sqrtRatioBX96 / sqrtRatioAX96;
}

/**
 * Amount of token1 provided by liquidity between two sqrt prices.
 */
function amount1Delta(
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  liquidity: bigint
): bigint {
  if (sqrtRatioAX96 > sqrtRatioBX96)
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  return (liquidity * (sqrtRatioBX96 - sqrtRatioAX96)) / Q96;
}

/**
 * Given a position's liquidity, ticks, and the pool's current state,
 * returns the raw (integer) token amounts currently in the position.
 *
 * Three cases:
 *  - current price < lower tick → all in token0
 *  - lower tick ≤ current price < upper tick → split between both
 *  - current price ≥ upper tick → all in token1
 */
export function getPositionAmounts(
  liquidity: bigint,
  currentTick: number,
  tickLower: number,
  tickUpper: number,
  sqrtPriceX96: bigint
): { amount0Raw: bigint; amount1Raw: bigint } {
  if (liquidity === 0n) return { amount0Raw: 0n, amount1Raw: 0n };

  const sqrtA = getSqrtRatioAtTick(tickLower);
  const sqrtB = getSqrtRatioAtTick(tickUpper);

  if (currentTick < tickLower) {
    return {
      amount0Raw: amount0Delta(sqrtA, sqrtB, liquidity),
      amount1Raw: 0n,
    };
  } else if (currentTick < tickUpper) {
    return {
      amount0Raw: amount0Delta(sqrtPriceX96, sqrtB, liquidity),
      amount1Raw: amount1Delta(sqrtA, sqrtPriceX96, liquidity),
    };
  } else {
    return {
      amount0Raw: 0n,
      amount1Raw: amount1Delta(sqrtA, sqrtB, liquidity),
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Safe uint256-wrapping subtraction (handles feeGrowth underflow).
 */
export function sub256(a: bigint, b: bigint): bigint {
  return ((a - b) % UINT256_MAX + UINT256_MAX) % UINT256_MAX;
}

/**
 * Convert a raw token amount (with decimals) to a human-readable float.
 */
export function formatTokenAmount(raw: bigint, decimals: number): number {
  if (raw === 0n) return 0;
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const fraction = raw % divisor;
  return Number(whole) + Number(fraction) / 10 ** decimals;
}

/**
 * Convert sqrtPriceX96 → human price of token1 in terms of token0.
 * ONLY use for display — not for amount calculations.
 */
export function sqrtX96ToPrice(
  sqrtPriceX96: bigint,
  token0Decimals: number,
  token1Decimals: number
): number {
  const sqrtFloat = Number(sqrtPriceX96) / Number(Q96);
  const rawPrice = sqrtFloat ** 2;
  return rawPrice * 10 ** token0Decimals / 10 ** token1Decimals;
}

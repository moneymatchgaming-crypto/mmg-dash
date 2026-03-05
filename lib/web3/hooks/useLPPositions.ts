"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { Address } from "viem";
import { POSITION_MANAGER_ABI, FACTORY_ABI, POOL_ABI, ERC20_ABI } from "@/lib/pnl/abis";
import { ADDRESSES, BASE_CHAIN_ID, MAX_LP_POSITIONS, STALE_TIMES } from "@/lib/pnl/constants";
import { getPositionAmounts, formatTokenAmount } from "@/lib/pnl/math";
import { getAlchemyUrl, hasAlchemyKey, fetchAlchemyTokenMetadata } from "@/lib/pnl/alchemy";
import type { UniV3Position } from "@/lib/pnl/types";

type Slot0Result = [bigint, number, number, number, number, number, boolean];

/**
 * Reads all Uniswap v3 LP positions for a wallet on Base.
 *
 * Chain of calls (all batched via publicClient.multicall):
 *   1. balanceOf(wallet)                         → N positions
 *   2. tokenOfOwnerByIndex(wallet, 0..N-1)        → tokenIds
 *   3. positions(tokenId) for each               → raw position data
 *   4. getPool(t0, t1, fee) for unique pools      → pool addresses
 *   5. slot0() for each pool                      → sqrtPriceX96, currentTick
 *   6. Token metadata (Alchemy or viem fallback)
 *
 * Includes closed positions (liquidity = 0) — filtered in UI.
 */
export function useLPPositions(address?: Address): {
  positions: UniV3Position[];
  isLoading: boolean;
  tokenAddresses: string[];
} {
  const publicClient = usePublicClient({ chainId: BASE_CHAIN_ID });

  const { data, isPending } = useQuery<UniV3Position[]>({
    queryKey: ["lpPositions", address, BASE_CHAIN_ID],
    queryFn: async (): Promise<UniV3Position[]> => {
      if (!address || !publicClient) return [];

      // ── Step 1: position count ──────────────────────────────────────────
      const positionCount = await publicClient.readContract({
        address: ADDRESSES.UNISWAP_V3_POSITION_MANAGER,
        abi: POSITION_MANAGER_ABI,
        functionName: "balanceOf",
        args: [address],
      });
      if (positionCount === 0n) return [];

      const count = Math.min(Number(positionCount), MAX_LP_POSITIONS);

      // ── Step 2: token IDs ───────────────────────────────────────────────
      const tokenIdResults = await publicClient.multicall({
        contracts: Array.from({ length: count }, (_, i) => ({
          address: ADDRESSES.UNISWAP_V3_POSITION_MANAGER,
          abi: POSITION_MANAGER_ABI,
          functionName: "tokenOfOwnerByIndex" as const,
          args: [address, BigInt(i)] as const,
        })),
      });
      const tokenIds = tokenIdResults
        .filter((r) => r.status === "success")
        .map((r) => r.result as bigint);
      if (tokenIds.length === 0) return [];

      // ── Step 3: position data ───────────────────────────────────────────
      const positionResults = await publicClient.multicall({
        contracts: tokenIds.map((id) => ({
          address: ADDRESSES.UNISWAP_V3_POSITION_MANAGER,
          abi: POSITION_MANAGER_ABI,
          functionName: "positions" as const,
          args: [id] as const,
        })),
      });

      type RawPos = {
        nonce: bigint; operator: Address;
        token0: Address; token1: Address;
        fee: number; tickLower: number; tickUpper: number;
        liquidity: bigint;
        feeGrowthInside0LastX128: bigint; feeGrowthInside1LastX128: bigint;
        tokensOwed0: bigint; tokensOwed1: bigint;
      };

      const rawPositions = positionResults
        .map((r, i) => {
          if (r.status !== "success") return null;
          const t = r.result as readonly [
            bigint, Address, Address, Address, number, number, number,
            bigint, bigint, bigint, bigint, bigint
          ];
          return {
            tokenId: tokenIds[i],
            nonce: t[0], operator: t[1],
            token0: t[2].toLowerCase() as Address,
            token1: t[3].toLowerCase() as Address,
            fee: t[4], tickLower: t[5], tickUpper: t[6],
            liquidity: t[7],
            feeGrowthInside0LastX128: t[8], feeGrowthInside1LastX128: t[9],
            tokensOwed0: t[10], tokensOwed1: t[11],
          } satisfies RawPos & { tokenId: bigint };
        })
        .filter(Boolean) as Array<RawPos & { tokenId: bigint }>;

      if (rawPositions.length === 0) return [];

      // ── Step 4: pool addresses ──────────────────────────────────────────
      const uniquePoolKeys = [
        ...new Set(rawPositions.map((p) => `${p.token0}-${p.token1}-${p.fee}`)),
      ];
      const uniquePools = uniquePoolKeys.map((k) => {
        const [token0, token1, fee] = k.split("-");
        return { token0: token0 as Address, token1: token1 as Address, fee: Number(fee) };
      });

      const poolAddrResults = await publicClient.multicall({
        contracts: uniquePools.map((p) => ({
          address: ADDRESSES.UNISWAP_V3_FACTORY,
          abi: FACTORY_ABI,
          functionName: "getPool" as const,
          args: [p.token0, p.token1, p.fee] as const,
        })),
      });

      const poolAddressMap = new Map<string, Address>();
      uniquePools.forEach((p, i) => {
        const r = poolAddrResults[i];
        if (r.status === "success" && r.result !== "0x0000000000000000000000000000000000000000") {
          poolAddressMap.set(`${p.token0}-${p.token1}-${p.fee}`, (r.result as Address).toLowerCase() as Address);
        }
      });

      // ── Step 5: slot0 for each pool ─────────────────────────────────────
      const validPoolAddrs = [...new Set([...poolAddressMap.values()])];
      const slot0Results = await publicClient.multicall({
        contracts: validPoolAddrs.map((addr) => ({
          address: addr,
          abi: POOL_ABI,
          functionName: "slot0" as const,
        })),
      });

      const poolSlot0Map = new Map<string, { sqrtPriceX96: bigint; tick: number }>();
      validPoolAddrs.forEach((addr, i) => {
        const r = slot0Results[i];
        if (r.status === "success") {
          const [sqrtPriceX96, tick] = r.result as Slot0Result;
          poolSlot0Map.set(addr.toLowerCase(), { sqrtPriceX96, tick });
        }
      });

      // ── Step 6: token metadata ──────────────────────────────────────────
      const uniqueTokens = [
        ...new Set(rawPositions.flatMap((p) => [p.token0, p.token1])),
      ] as Address[];

      const metaMap = new Map<Address, { symbol: string; decimals: number }>();

      if (hasAlchemyKey()) {
        const alchemyMeta = await fetchAlchemyTokenMetadata(getAlchemyUrl()!, uniqueTokens);
        alchemyMeta.forEach((v, k) => metaMap.set(k, { symbol: v.symbol, decimals: v.decimals }));
      } else {
        // viem fallback: read symbol + decimals from each ERC-20
        const metaResults = await publicClient.multicall({
          contracts: uniqueTokens.flatMap((addr) => [
            { address: addr, abi: ERC20_ABI, functionName: "symbol" as const },
            { address: addr, abi: ERC20_ABI, functionName: "decimals" as const },
          ]),
        });
        uniqueTokens.forEach((addr, i) => {
          const sym = metaResults[i * 2];
          const dec = metaResults[i * 2 + 1];
          metaMap.set(addr, {
            symbol:   sym.status === "success" ? (sym.result as string) : "???",
            decimals: dec.status === "success" ? Number(dec.result) : 18,
          });
        });
      }

      // ── Compute final positions ─────────────────────────────────────────
      return rawPositions.map((pos) => {
        const poolKey = `${pos.token0}-${pos.token1}-${pos.fee}`;
        const poolAddr = poolAddressMap.get(poolKey) ?? null;
        const slot0 = poolAddr ? poolSlot0Map.get(poolAddr.toLowerCase()) : null;
        const meta0 = metaMap.get(pos.token0) ?? { symbol: "???", decimals: 18 };
        const meta1 = metaMap.get(pos.token1) ?? { symbol: "???", decimals: 18 };

        const { amount0Raw, amount1Raw } = slot0
          ? getPositionAmounts(
              pos.liquidity,
              slot0.tick,
              pos.tickLower,
              pos.tickUpper,
              slot0.sqrtPriceX96
            )
          : { amount0Raw: 0n, amount1Raw: 0n };

        return {
          tokenId: pos.tokenId,
          token0: pos.token0,
          token1: pos.token1,
          token0Symbol: meta0.symbol,
          token1Symbol: meta1.symbol,
          token0Decimals: meta0.decimals,
          token1Decimals: meta1.decimals,
          fee: pos.fee,
          tickLower: pos.tickLower,
          tickUpper: pos.tickUpper,
          currentTick: slot0?.tick ?? null,
          liquidity: pos.liquidity,
          amount0: formatTokenAmount(amount0Raw, meta0.decimals),
          amount1: formatTokenAmount(amount1Raw, meta1.decimals),
          uncollectedFees0: formatTokenAmount(pos.tokensOwed0, meta0.decimals),
          uncollectedFees1: formatTokenAmount(pos.tokensOwed1, meta1.decimals),
          isInRange: slot0
            ? slot0.tick >= pos.tickLower && slot0.tick < pos.tickUpper
            : false,
          isClosed: pos.liquidity === 0n,
          poolAddress: poolAddr,
        } satisfies UniV3Position;
      });
    },
    enabled: !!address && !!publicClient,
    staleTime: STALE_TIMES.LP_POSITIONS,
    refetchInterval: STALE_TIMES.LP_POSITIONS,
  });

  const positions = data ?? [];

  return {
    positions,
    isLoading: isPending,
    tokenAddresses: [
      ...new Set(positions.flatMap((p) => [p.token0.toLowerCase(), p.token1.toLowerCase()])),
    ],
  };
}

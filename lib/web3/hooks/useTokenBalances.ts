"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient, useBalance } from "wagmi";
import type { Address } from "viem";
import {
  getAlchemyUrl,
  hasAlchemyKey,
  fetchAlchemyTokenBalances,
  fetchAlchemyTokenMetadata,
} from "@/lib/pnl/alchemy";
import { ERC20_ABI } from "@/lib/pnl/abis";
import { BASE_CHAIN_ID, ETH_NATIVE_KEY, STALE_TIMES } from "@/lib/pnl/constants";
import { formatTokenAmount } from "@/lib/pnl/math";
import type { TokenBalance } from "@/lib/pnl/types";

/**
 * Fetch all ERC-20 token balances for the connected wallet on Base.
 *
 * Strategy:
 *   - If NEXT_PUBLIC_ALCHEMY_API_KEY is set → Alchemy Enhanced API
 *     (fast, gets all tokens, includes metadata in one round-trip)
 *   - Otherwise → viem multicall fallback
 *     (limited: only tokens with known addresses, no auto-discovery)
 */
export function useTokenBalances(address?: Address): {
  balances: TokenBalance[];
  isLoading: boolean;
  contractAddresses: string[];
} {
  const publicClient = usePublicClient({ chainId: BASE_CHAIN_ID });

  const { data, isPending } = useQuery<TokenBalance[]>({
    queryKey: ["tokenBalances", address, BASE_CHAIN_ID],
    queryFn: async (): Promise<TokenBalance[]> => {
      if (!address) return [];

      if (hasAlchemyKey()) {
        const url = getAlchemyUrl()!;

        // 1. Get all non-zero ERC-20 balances
        const rawBalances = await fetchAlchemyTokenBalances(url, address);
        if (rawBalances.length === 0) return [];

        // 2. Batch-fetch metadata for every token
        const metaMap = await fetchAlchemyTokenMetadata(
          url,
          rawBalances.map((b) => b.contractAddress)
        );

        // 3. Build enriched holdings
        return rawBalances.map((b) => {
          const meta = metaMap.get(b.contractAddress) ?? {
            symbol: "???",
            name: "Unknown Token",
            decimals: 18,
          };
          return {
            contractAddress: b.contractAddress,
            rawBalance: b.rawBalance,
            balanceFormatted: formatTokenAmount(b.rawBalance, meta.decimals),
            symbol: meta.symbol,
            name: meta.name,
            decimals: meta.decimals,
            logoURI: meta.logoURI,
          };
        });
      }

      // ── viem fallback: no auto-discovery, returns empty ──────────────────
      // Add token addresses here manually if not using Alchemy
      console.warn(
        "[useTokenBalances] No Alchemy key — set NEXT_PUBLIC_ALCHEMY_API_KEY for full token discovery."
      );
      return [];
    },
    enabled: !!address && !!publicClient,
    staleTime: STALE_TIMES.BALANCES,
    refetchInterval: STALE_TIMES.BALANCES,
  });

  const balances = data ?? [];

  return {
    balances,
    isLoading: isPending,
    contractAddresses: balances.map((b) => b.contractAddress.toLowerCase()),
  };
}

/**
 * Native ETH balance for the wallet (separate from ERC-20s).
 */
export function useNativeBalance(address?: Address) {
  const { data, isPending } = useBalance({
    address,
    chainId: BASE_CHAIN_ID,
    query: {
      enabled: !!address,
      staleTime: STALE_TIMES.BALANCES,
      refetchInterval: STALE_TIMES.BALANCES,
    },
  });

  return {
    /** raw wagmi balance object */
    data,
    /** formatted as a number */
    balanceFormatted: data ? Number(data.value) / 10 ** data.decimals : 0,
    isLoading: isPending,
    /** key used in price map */
    priceKey: ETH_NATIVE_KEY,
  };
}

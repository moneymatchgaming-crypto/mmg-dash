/**
 * Alchemy Enhanced API client for Base.
 * Falls back gracefully when no API key is configured.
 */

import type { Address } from "viem";
import type { TokenMetadata, AlchemyTransfer } from "./types";

// ─── Config ──────────────────────────────────────────────────────────────────

export function getAlchemyUrl(): string | null {
  const key = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  if (!key) return null;
  return `https://base-mainnet.g.alchemy.com/v2/${key}`;
}

export function hasAlchemyKey(): boolean {
  return !!process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
}

// ─── JSON-RPC helpers ────────────────────────────────────────────────────────

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params }),
  });
  if (!res.ok) throw new Error(`Alchemy ${method} failed: HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`Alchemy error: ${json.error.message}`);
  return json.result as T;
}

/** Batch JSON-RPC — sends an array of calls in one HTTP request */
async function rpcBatch<T>(
  url: string,
  calls: Array<{ method: string; params: unknown[] }>
): Promise<Array<T | null>> {
  const body = calls.map((c, i) => ({
    id: i,
    jsonrpc: "2.0",
    method: c.method,
    params: c.params,
  }));

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Alchemy batch failed: HTTP ${res.status}`);
  const responses = await res.json() as Array<{ id: number; result?: T; error?: { message: string } }>;

  // Sort by id to match original order
  const sorted = [...responses].sort((a, b) => a.id - b.id);
  return sorted.map((r) => (r.error || r.result === undefined ? null : r.result));
}

// ─── Token Balances ──────────────────────────────────────────────────────────

interface RawTokenBalance {
  contractAddress: Address;
  tokenBalance: string; // hex
}

/**
 * Fetch ALL ERC-20 token balances for a wallet, paginating through every page.
 * Alchemy returns up to 100 tokens per page — active DeFi wallets exceed this easily.
 * Returns only tokens with non-zero balance.
 */
export async function fetchAlchemyTokenBalances(
  url: string,
  address: Address
): Promise<Array<{ contractAddress: Address; rawBalance: bigint }>> {
  const allBalances: RawTokenBalance[] = [];
  let pageKey: string | undefined;

  const ZERO_BALANCE = "0x0000000000000000000000000000000000000000000000000000000000000000";

  do {
    const params: unknown[] = pageKey
      ? [address, "erc20", { pageKey }]
      : [address, "erc20"];

    const result = await rpc<{ tokenBalances: RawTokenBalance[]; pageKey?: string }>(
      url,
      "alchemy_getTokenBalances",
      params
    );

    allBalances.push(...result.tokenBalances);
    pageKey = result.pageKey;
  } while (pageKey);

  return allBalances
    .filter((b) => b.tokenBalance && b.tokenBalance !== ZERO_BALANCE && BigInt(b.tokenBalance) > 0n)
    .map((b) => ({
      contractAddress: b.contractAddress.toLowerCase() as Address,
      rawBalance: BigInt(b.tokenBalance),
    }));
}

// ─── Token Metadata ──────────────────────────────────────────────────────────

interface AlchemyMetadataResult {
  decimals: number | null;
  logo: string | null;
  name: string | null;
  symbol: string | null;
}

/**
 * Batch-fetch metadata for multiple token contracts.
 * Chunks into 50-request batches to stay within limits.
 */
export async function fetchAlchemyTokenMetadata(
  url: string,
  contractAddresses: Address[]
): Promise<Map<Address, TokenMetadata>> {
  const CHUNK = 50;
  const map = new Map<Address, TokenMetadata>();

  for (let i = 0; i < contractAddresses.length; i += CHUNK) {
    const chunk = contractAddresses.slice(i, i + CHUNK);
    const calls = chunk.map((addr) => ({
      method: "alchemy_getTokenMetadata",
      params: [addr],
    }));

    const results = await rpcBatch<AlchemyMetadataResult>(url, calls);
    results.forEach((result, j) => {
      const addr = chunk[j].toLowerCase() as Address;
      map.set(addr, {
        symbol:   result?.symbol   ?? "???",
        name:     result?.name     ?? "Unknown Token",
        decimals: result?.decimals ?? 18,
        logoURI:  result?.logo     ?? undefined,
      });
    });
  }

  return map;
}

// ─── Asset Transfers ─────────────────────────────────────────────────────────

export interface AssetTransferParams {
  fromBlock?: string;
  toBlock?: string;
  fromAddress?: Address;
  toAddress?: Address;
  /** e.g. ["erc20", "external", "internal"] */
  category: string[];
  maxCount?: string;
  pageKey?: string;
  withMetadata?: boolean;
}

export async function fetchAlchemyTransfers(
  url: string,
  params: AssetTransferParams
): Promise<{ transfers: AlchemyTransfer[]; pageKey?: string }> {
  const result = await rpc<{ transfers: AlchemyTransfer[]; pageKey?: string }>(
    url,
    "alchemy_getAssetTransfers",
    [{ excludeZeroValue: true, withMetadata: true, maxCount: "0x3e8", ...params }]
  );
  return result;
}

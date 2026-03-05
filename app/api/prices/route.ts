/**
 * /api/prices — server-side price fetching endpoint.
 *
 * Accepts: POST { addresses: string[] }
 * Returns: { prices: Record<address, { priceUSD, change24hPct, source }> }
 *
 * Running server-side means:
 *   - No browser CORS restrictions
 *   - API keys stay off the client bundle (use plain env vars, not NEXT_PUBLIC_)
 *   - CoinGecko Pro key can be used without exposing it
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchPricesWithFallback } from "@/lib/pnl/prices";

export async function POST(req: NextRequest) {
  try {
    const { addresses } = await req.json() as { addresses: string[] };

    if (!Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json({ prices: {} });
    }

    const priceMap = await fetchPricesWithFallback(addresses);

    // Convert Map → plain object for JSON serialization
    const prices: Record<string, { priceUSD: number; change24hPct: number | null; source: string }> = {};
    priceMap.forEach((v, k) => {
      prices[k] = v;
    });

    return NextResponse.json({ prices });
  } catch (err) {
    console.error("[/api/prices]", err);
    return NextResponse.json({ prices: {} }, { status: 500 });
  }
}

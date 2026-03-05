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

/**
 * Protocol token aliases — map a token address to another token's price.
 * Used for receipt/wrapper tokens that track an underlying 1:1.
 * Key: token address (lowercase), Value: underlying address (lowercase)
 *
 * NOTE: veVIRTUAL (0x14559863...) is intentionally excluded — it is a
 * governance-only voting token with no monetary value per Virtuals Protocol.
 */
const PRICE_ALIASES: Record<string, string> = {
  // Add wrapper/receipt token aliases here as needed, e.g.:
  // "0xwrapped...": "0xunderlying...",
};

export async function POST(req: NextRequest) {
  try {
    const { addresses } = await req.json() as { addresses: string[] };

    if (!Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json({ prices: {} });
    }

    const priceMap = await fetchPricesWithFallback(addresses);

    // Apply protocol token aliases (e.g. veVIRTUAL → VIRTUAL price)
    for (const [aliasAddr, underlyingAddr] of Object.entries(PRICE_ALIASES)) {
      if (addresses.map(a => a.toLowerCase()).includes(aliasAddr) && !priceMap.has(aliasAddr)) {
        const underlyingPrice = priceMap.get(underlyingAddr.toLowerCase());
        if (underlyingPrice) {
          priceMap.set(aliasAddr, { ...underlyingPrice });
        }
      }
    }

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

import { createConfig, http } from "wagmi";
import { mainnet, polygon, arbitrum, base, optimism } from "wagmi/chains";
import { injected, coinbaseWallet } from "wagmi/connectors";

/**
 * Wagmi config for MMG-Dash.
 *
 * WalletConnect requires a project ID from https://cloud.walletconnect.com
 * Set NEXT_PUBLIC_WC_PROJECT_ID in your .env.local to enable it.
 *
 * Set NEXT_PUBLIC_ALCHEMY_API_KEY to use Alchemy RPCs (faster, higher rate limits).
 */

const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

// Only use Alchemy for Base — the API key is scoped to Base Mainnet only.
// All other chains fall back to their public RPC endpoints to avoid 403s.
export const config = createConfig({
  chains: [mainnet, base, arbitrum, optimism, polygon],
  connectors: [
    injected(),
    coinbaseWallet({ appName: "MMG-Dash" }),
    // Uncomment when WC project ID is set:
    // walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID! }),
  ],
  transports: {
    [mainnet.id]:   http(),   // public RPC — Alchemy key is Base-only
    [base.id]:      alchemyKey ? http(`https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`) : http(),
    [arbitrum.id]:  http(),   // public RPC
    [optimism.id]:  http(),   // public RPC
    [polygon.id]:   http(),   // public RPC
  },
});

export const SUPPORTED_CHAINS = [mainnet, base, arbitrum, optimism, polygon];

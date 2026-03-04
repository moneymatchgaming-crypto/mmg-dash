import { createConfig, http } from "wagmi";
import { mainnet, polygon, arbitrum, base, optimism } from "wagmi/chains";
import { injected, coinbaseWallet } from "wagmi/connectors";

/**
 * Wagmi config for MMG-Dash.
 *
 * WalletConnect requires a project ID from https://cloud.walletconnect.com
 * Set NEXT_PUBLIC_WC_PROJECT_ID in your .env.local to enable it.
 */
export const config = createConfig({
  chains: [mainnet, base, arbitrum, optimism, polygon],
  connectors: [
    injected(),
    coinbaseWallet({ appName: "MMG-Dash" }),
    // Uncomment when WC project ID is set:
    // walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID! }),
  ],
  transports: {
    [mainnet.id]:   http(),
    [base.id]:      http(),
    [arbitrum.id]:  http(),
    [optimism.id]:  http(),
    [polygon.id]:   http(),
  },
});

export const SUPPORTED_CHAINS = [mainnet, base, arbitrum, optimism, polygon];

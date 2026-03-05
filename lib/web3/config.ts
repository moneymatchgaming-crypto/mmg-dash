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

function alchemyTransport(network: string) {
  return alchemyKey
    ? http(`https://${network}.g.alchemy.com/v2/${alchemyKey}`)
    : http();
}

export const config = createConfig({
  chains: [mainnet, base, arbitrum, optimism, polygon],
  connectors: [
    injected(),
    coinbaseWallet({ appName: "MMG-Dash" }),
    // Uncomment when WC project ID is set:
    // walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID! }),
  ],
  transports: {
    [mainnet.id]:   alchemyTransport("eth-mainnet"),
    [base.id]:      alchemyTransport("base-mainnet"),
    [arbitrum.id]:  alchemyTransport("arb-mainnet"),
    [optimism.id]:  alchemyTransport("opt-mainnet"),
    [polygon.id]:   alchemyTransport("polygon-mainnet"),
  },
});

export const SUPPORTED_CHAINS = [mainnet, base, arbitrum, optimism, polygon];

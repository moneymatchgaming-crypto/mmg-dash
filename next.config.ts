import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Covalent / GoldRush token logos
      { protocol: "https", hostname: "logos.covalenthq.com" },
      // Alchemy token logos (returned by alchemy_getTokenMetadata)
      { protocol: "https", hostname: "static.alchemyapi.io" },
      // Generic token logo CDNs
      { protocol: "https", hostname: "assets.coingecko.com" },
      { protocol: "https", hostname: "raw.githubusercontent.com" },
      { protocol: "https", hostname: "tokens.1inch.io" },
      { protocol: "https", hostname: "coin-images.coingecko.com" },
    ],
  },
};

export default nextConfig;

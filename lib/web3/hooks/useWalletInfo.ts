"use client";

import { useAccount, useBalance, useChainId, useEnsName } from "wagmi";
import { formatAddress } from "@/lib/utils";

export function useWalletInfo() {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const chainId = useChainId();

  const { data: balance } = useBalance({
    address,
    query: { enabled: isConnected },
  });

  const { data: ensName } = useEnsName({
    address,
    query: { enabled: isConnected },
  });

  const displayAddress = ensName ?? (address ? formatAddress(address) : null);

  return {
    address,
    isConnected,
    isConnecting: isConnecting || isReconnecting,
    chainId,
    balance,
    ensName,
    displayAddress,
  };
}

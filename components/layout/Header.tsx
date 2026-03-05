"use client";

import { useState, useEffect } from "react";
import { Wallet, LogOut, Loader2 } from "lucide-react";
import { useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { Button } from "@/components/ui/button";
import { useWalletInfo } from "@/lib/web3/hooks/useWalletInfo";
import { SUPPORTED_CHAINS } from "@/lib/web3/config";

function ChainBadge({ chainId }: { chainId: number }) {
  const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent text-muted-foreground">
      {chain?.name ?? `Chain ${chainId}`}
    </span>
  );
}

export function Header() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { address, isConnected, isConnecting, chainId, displayAddress } =
    useWalletInfo();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  // Render a stable skeleton until client hydration is complete.
  // Prevents server/client mismatch from wagmi's wallet state being unknown on the server.
  if (!mounted) {
    return (
      <header className="flex items-center justify-between h-14 px-6 border-b border-border bg-background/60 backdrop-blur-sm flex-shrink-0">
        <div />
        <Button disabled>
          <Wallet className="w-4 h-4" />
          Connect Wallet
        </Button>
      </header>
    );
  }

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-border bg-background/60 backdrop-blur-sm flex-shrink-0">
      {/* Left: breadcrumb placeholder */}
      <div />

      {/* Right: wallet controls */}
      <div className="flex items-center gap-2">
        {isConnecting && (
          <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
        )}

        {isConnected && address ? (
          <div className="flex items-center gap-2">
            {chainId && <ChainBadge chainId={chainId} />}

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="font-mono text-foreground">{displayAddress}</span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => disconnect()}
              title="Disconnect wallet"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => connect({ connector: injected() })}
            disabled={isConnecting}
          >
            <Wallet className="w-4 h-4" />
            Connect Wallet
          </Button>
        )}
      </div>
    </header>
  );
}

"use client";

import { X, ChevronLeft } from "lucide-react";
import { WalletConnect } from "../WalletConnect";

interface TopBarProps {
  walletVisible: boolean;
  onToggleWallet: () => void;
  isConnected?: boolean;
  walletAddress?: string | null;
  walletBalance?: string;
  onConnect?: (address: string, balance: string) => void;
  onDisconnect?: () => void;
}

export function TopBar({
  walletVisible,
  onToggleWallet,
  isConnected,
  walletAddress,
  walletBalance,
  onConnect,
  onDisconnect,
}: TopBarProps) {
  return (
    <div className="absolute top-0 right-0 z-30 p-4 flex items-start gap-4">
      {walletVisible && (
        <WalletConnect
          isConnected={isConnected}
          walletAddress={walletAddress}
          walletBalance={walletBalance}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
        />
      )}
      <button
        onClick={onToggleWallet}
        className="p-2 hover:bg-white/10 rounded-lg transition-all text-gray-500 hover:text-white"
        title={walletVisible ? "Hide wallet" : "Show wallet"}
      >
        {walletVisible ? <X size={20} /> : <ChevronLeft size={20} />}
      </button>
    </div>
  );
}

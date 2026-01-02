"use client";

import { useState } from "react";
import { Wallet, AlertCircle } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { WalletHeader } from "./WalletHeader";
import { WalletBalance } from "./WalletBalance";
import { ActionButtons } from "./ActionButtons";
import { PublicKeyDisplay } from "./PublicKeyDisplay";
import { TransactionHistory } from "./TransactionHistory";
import { WalletFooter } from "./WalletFooter";
import type { WalletConnectProps, Transaction } from "./types";

export function WalletConnect({
  isConnected: externalIsConnected,
  walletAddress: externalWalletAddress,
  walletBalance: externalWalletBalance,
  onConnect,
  onDisconnect,
}: WalletConnectProps) {
  const walletContext = useWallet();
  const { isConnecting, error, handleConnect, handleDisconnect, setError } =
    useWalletConnection();
  const [isHydrated] = useState(true);

  const isConnectedState =
    walletContext?.isConnected ?? externalIsConnected ?? false;
  const walletAddressState =
    walletContext?.walletAddress ?? externalWalletAddress;

  const { balance } = useWalletBalance(externalWalletBalance);

  const mockTransactions: Transaction[] = [
    {
      id: "1",
      type: "receive",
      amount: "100.00 XLM",
      from: "GBXXX...XXXX",
      timestamp: "2 hours ago",
      status: "completed",
    },
    {
      id: "2",
      type: "send",
      amount: "50.00 XLM",
      to: "GAYYY...YYYY",
      timestamp: "1 day ago",
      status: "completed",
    },
    {
      id: "3",
      type: "swap",
      amount: "25.00 XLM → 0.5 USDC",
      timestamp: "3 days ago",
      status: "completed",
    },
  ];

  const handleDisconnectClick = () => {
    handleDisconnect();
    if (onDisconnect) {
      onDisconnect();
    }
  };

  const handleConnectClick = async () => {
    await handleConnect();
    if (onConnect && walletAddressState) {
      onConnect(walletAddressState, balance);
    }
  };

  if (!isHydrated) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-black border border-white/10 text-white rounded-lg">
        <Wallet size={16} className="animate-pulse" />
        <span className="text-sm">Loading wallet...</span>
      </div>
    );
  }

  if (!isConnectedState) {
    return (
      <div>
        <button
          onClick={handleConnectClick}
          disabled={isConnecting}
          className="flex items-center gap-2 px-4 py-2 bg-black border border-white/10 text-white hover:bg-white/5 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
        >
          <Wallet size={16} />
          {isConnecting ? "Connecting..." : "Connect Wallet"}
        </button>
        {error && (
          <div className="absolute top-16 right-0 w-96 bg-red-500/10 border border-red-500/30 rounded-lg p-3 mt-2">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-300 text-xs">{error}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-96 bg-black border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
      <WalletHeader onDisconnect={handleDisconnectClick} />

      <div className="p-6 space-y-5">
        <WalletBalance balance={balance} />
        <ActionButtons />
        <PublicKeyDisplay walletAddress={walletAddressState} />
        <TransactionHistory transactions={mockTransactions} />
      </div>

      <WalletFooter />
    </div>
  );
}

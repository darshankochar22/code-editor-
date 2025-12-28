"use client";

import { useState, useEffect, useCallback } from "react";
import { isConnected, setAllowed, getAddress } from "@stellar/freighter-api";

type LogFunction = (
  message: string,
  type: "log" | "error" | "warn" | "info"
) => void;

interface UseWalletReturn {
  connected: boolean;
  publicKey: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  isFreighterAvailable: () => boolean;
}

export function useWallet(onLog: LogFunction): UseWalletReturn {
  const [connected, setConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const isFreighterAvailable = useCallback(() => {
    if (typeof window === "undefined") return false;
    return (
      (window as unknown as Record<string, unknown>).freighter !== undefined
    );
  }, []);

  // Check if wallet is already connected on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window === "undefined") return;

      try {
        if (!isFreighterAvailable()) {
          console.log("Freighter not installed");
          return;
        }

        const alreadyConnected = await isConnected();
        if (alreadyConnected) {
          const result = await getAddress();
          setConnected(true);
          setPublicKey(result.address || null);
          console.log("Already connected to wallet:", result.address);
        }
      } catch (err) {
        console.log("Not connected to wallet:", err);
      }
    };

    checkConnection();
  }, [isFreighterAvailable]);

  const connectWallet = useCallback(async () => {
    try {
      onLog("Connecting to Freighter wallet...", "info");

      if (typeof window === "undefined") return;

      const connectionStatus = await isConnected();
      if (!connectionStatus.isConnected) {
        onLog("✗ Freighter wallet not found", "error");
        window.open("https://www.freighter.app/", "_blank");
        return;
      }

      const access = await setAllowed();

      if (access.isAllowed) {
        const { address, error } = await getAddress();

        if (address) {
          setPublicKey(address);
          setConnected(true);
          onLog(
            `✓ Wallet connected: ${address.slice(0, 4)}...${address.slice(-4)}`,
            "log"
          );
        } else {
          throw new Error(error || "Failed to retrieve address");
        }
      } else {
        onLog("✗ User declined wallet access", "warn");
        throw new Error("User declined access");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      onLog(`✗ Connection error: ${errorMessage}`, "error");
      setConnected(false);
    }
  }, [onLog]);

  const disconnectWallet = useCallback(() => {
    setConnected(false);
    setPublicKey(null);
    onLog("✓ Wallet disconnected", "log");
  }, [onLog]);

  return {
    connected,
    publicKey,
    connectWallet,
    disconnectWallet,
    isFreighterAvailable,
  };
}


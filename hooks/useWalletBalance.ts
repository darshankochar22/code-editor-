"use client";

import { useWallet } from "@/context/WalletContext";

export function useWalletBalance(
  externalBalance?: string
): { balance: string } {
  const walletContext = useWallet();
  const balance = walletContext?.walletBalance ?? externalBalance ?? "0.00";

  return { balance };
}


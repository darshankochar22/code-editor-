export interface Transaction {
  id: string;
  type: "send" | "receive" | "swap";
  amount: string;
  to?: string;
  from?: string;
  timestamp: string;
  status: "completed" | "pending";
}

export interface WalletConnectProps {
  isConnected?: boolean;
  walletAddress?: string | null;
  walletBalance?: string;
  onConnect?: (address: string, balance: string) => void;
  onDisconnect?: () => void;
}


"use client";

import { LogOut } from "lucide-react";

interface WalletHeaderProps {
  onDisconnect: () => void;
}

export function WalletHeader({ onDisconnect }: WalletHeaderProps) {
  return (
    <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <p className="text-white font-semibold text-sm">Connected</p>
      </div>
      <button
        onClick={onDisconnect}
        className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-gray-500 hover:text-red-400"
        title="Disconnect"
      >
        <LogOut size={16} />
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";

interface PublicKeyDisplayProps {
  walletAddress: string | null | undefined;
}

export function PublicKeyDisplay({ walletAddress }: PublicKeyDisplayProps) {
  const [showFullKey, setShowFullKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const truncateKey = (key: string) => {
    return `${key.slice(0, 6)}...${key.slice(-6)}`;
  };

  const handleCopyKey = async () => {
    if (walletAddress) {
      await navigator.clipboard.writeText(walletAddress);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <div className="bg-white/2 rounded-xl p-4 border border-white/5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-gray-500 text-xs uppercase tracking-widest font-semibold">
          Public Key
        </p>
        <button
          onClick={() => setShowFullKey(!showFullKey)}
          className="p-1 hover:bg-white/10 rounded transition-all text-gray-500 hover:text-gray-300"
          title={showFullKey ? "Hide" : "Show"}
        >
          {showFullKey ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      <div className="flex items-center gap-2 bg-black/40 rounded-lg px-3 py-2">
        <p className="text-gray-300 text-xs font-mono flex-1 truncate">
          {showFullKey ? walletAddress : truncateKey(walletAddress || "")}
        </p>
        <button
          onClick={handleCopyKey}
          className="p-1.5 hover:bg-white/10 rounded transition-all text-gray-500 hover:text-gray-300 flex-shrink-0"
          title="Copy public key"
        >
          {copiedKey ? (
            <Check size={14} className="text-green-400" />
          ) : (
            <Copy size={14} />
          )}
        </button>
      </div>
    </div>
  );
}

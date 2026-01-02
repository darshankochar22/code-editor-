"use client";

interface WalletBalanceProps {
  balance: string;
}

export function WalletBalance({ balance }: WalletBalanceProps) {
  return (
    <div className="bg-white/2 rounded-xl p-4 border border-white/5">
      <p className="text-gray-500 text-xs uppercase tracking-widest mb-2 font-semibold">
        Balance
      </p>
      <div className="flex items-baseline gap-2">
        <h2 className="text-2xl font-bold text-white">{balance}</h2>
        <span className="text-gray-400 text-sm">XLM</span>
      </div>
    </div>
  );
}

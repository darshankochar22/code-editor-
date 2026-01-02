"use client";

import { ArrowUpRight, ArrowDownLeft, Repeat2 } from "lucide-react";
import type { Transaction } from "./types";

interface TransactionHistoryProps {
  transactions: Transaction[];
}

export function TransactionHistory({ transactions }: TransactionHistoryProps) {
  return (
    <div className="bg-white/2 rounded-xl p-4 border border-white/5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-gray-500 text-xs uppercase tracking-widest font-semibold">
          Recent Activity
        </p>
        <p className="text-gray-600 text-xs cursor-pointer hover:text-gray-300">
          View All
        </p>
      </div>
      <div className="space-y-2">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-all"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                {tx.type === "send" && (
                  <ArrowUpRight size={14} className="text-white" />
                )}
                {tx.type === "receive" && (
                  <ArrowDownLeft size={14} className="text-white" />
                )}
                {tx.type === "swap" && (
                  <Repeat2 size={14} className="text-white" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-gray-300 text-xs font-medium capitalize">
                  {tx.type}
                  {tx.to && ` to ${tx.to}`}
                  {tx.from && ` from ${tx.from}`}
                </p>
                <p className="text-gray-600 text-xs">{tx.timestamp}</p>
              </div>
            </div>
            <p className="text-gray-300 text-xs font-mono shrink-0 ml-2">
              {tx.amount}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

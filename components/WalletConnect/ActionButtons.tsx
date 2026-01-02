"use client";

import { ArrowUpRight, ArrowDownLeft, Repeat2 } from "lucide-react";

export function ActionButtons() {
  return (
    <div className="grid grid-cols-3 gap-3">
      <button className="py-3 px-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-white text-xs font-semibold transition-all hover:text-white flex flex-col items-center gap-2">
        <ArrowUpRight size={18} className="text-white" />
        Send
      </button>
      <button className="py-3 px-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-white text-xs font-semibold transition-all hover:text-white flex flex-col items-center gap-2">
        <ArrowDownLeft size={18} className="text-white" />
        Receive
      </button>
      <button className="py-3 px-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-white text-xs font-semibold transition-all hover:text-white flex flex-col items-center gap-2">
        <Repeat2 size={18} className="text-white" />
        Swap
      </button>
    </div>
  );
}

"use client";

import { Send } from "lucide-react";

interface HeroSectionProps {
  promptValue: string;
  onPromptChange: (value: string) => void;
}

export function HeroSection({ promptValue, onPromptChange }: HeroSectionProps) {
  return (
    <div className="text-center mb-12">
      <h2 className="text-5xl font-bold text-white mb-4">
        Build Smart Contracts
      </h2>
      <p className="text-gray-500 text-lg">
        Start creating, testing, and deploying your Soroban smart contracts
      </p>

      {/* Prompt Bar */}
      <div className="mb-8 mt-8">
        <div className="relative group">
          <div className="absolute inset-0 bg-white/2 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
          <div className="relative border border-white/10 rounded-2xl p-1.5 bg-[#080802]">
            <div className="flex items-end gap-3 p-3">
              <textarea
                value={promptValue}
                onChange={(e) => onPromptChange(e.target.value)}
                placeholder="Coming soon"
                className="flex-1  text-white placeholder-gray-600 resize-none focus:outline-none min-h-[56px] max-h-[200px] py-3 px-2"
                rows={1}
              />
              <button className="p-3 bg-white hover:bg-gray-200 text-black rounded-xl transition-all duration-200 opacity-50 cursor-not-allowed">
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-600 text-center mt-3">
          AI assistant coming soon • Get help with code, debugging, and
          deployment
        </p>
      </div>
    </div>
  );
}

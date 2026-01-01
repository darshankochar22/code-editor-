"use client";

import { useState } from "react";
import { deployWithWallet } from "@/lib/wallet-deploy";

interface DeployButtonProps {
  userId: string;
  onLog: (message: string, type: "log" | "error" | "warn" | "info") => void;
  isConnected: boolean;
  onConnectWallet: () => Promise<void>;
  projectName?: string;
}

export function DeployButton({
  userId,
  onLog,
  isConnected,
  onConnectWallet,
  projectName,
}: DeployButtonProps) {
  const [isDeploying, setIsDeploying] = useState(false);

  const handleDeploy = async () => {
    if (!userId) {
      onLog("✗ User ID not found", "error");
      return;
    }

    // Check wallet connection
    if (!isConnected) {
      onLog("Wallet not connected. Connecting...", "warn");
      await onConnectWallet();

      // Give it a moment
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (!isConnected) {
        onLog("✗ Wallet connection required", "error");
        return;
      }
    }

    setIsDeploying(true);

    try {
      const result = await deployWithWallet(
        userId,
        (msg: string, type: string) => {
          onLog(msg, type as "log" | "error" | "warn" | "info");
        },
        projectName
      );

      if (result.success) {
        // Show success message
        alert(`🎉 Contract deployed!\nContract ID: ${result.contractId}`);
      } else {
        onLog(`✗ Deployment failed: ${result.error}`, "error");
      }
    } catch (error: any) {
      onLog(`✗ Unexpected error: ${error.message}`, "error");
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <button
      onClick={handleDeploy}
      disabled={isDeploying || !userId}
      className="text-xs px-3 py-1 rounded dark:bg-black hover:bg-[#171717] disabled:bg-gray-800 text-white disabled:opacity-50 transition-colors"
    >
      {isDeploying ? (
        <span className="flex items-center">
          <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24">
            {/* spinner SVG */}
          </svg>
          Deploying...
        </span>
      ) : (
        "Deploy"
      )}
    </button>
  );
}

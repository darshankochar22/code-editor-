"use client";

/**
 * Contract Deployment Hook (Archived)
 * 
 * This hook handles Stellar smart contract deployment.
 * Currently not in use but preserved for future implementation.
 * 
 * Reference: hooks/archived/useContractDeployment.ts
 * Status: Disabled - Awaiting backend API support
 * Last Updated: 2025-12-28
 */

import { useCallback } from "react";

interface UseContractDeploymentProps {
  userId: string;
  publicKey: string | null;
  logToTerminal: (message: string, type: "log" | "error" | "warn" | "info") => void;
  onContractLoading: (loading: boolean) => void;
  onError: (error: string | null) => void;
  onTerminalOpen: (open: boolean) => void;
}

export function useContractDeployment({
  userId,
  publicKey,
  logToTerminal,
  onContractLoading,
  onError,
  onTerminalOpen,
}: UseContractDeploymentProps) {
  // Deploy Contract
  const handleDeployContract = useCallback(async () => {
    if (!publicKey) {
      logToTerminal(
        "✗ Wallet not connected. Please connect your Freighter wallet first.",
        "error"
      );
      onError("Wallet not connected");
      return;
    }

    onContractLoading(true);
    onError(null);
    onTerminalOpen(true); // Auto-open terminal
    logToTerminal("Starting contract deployment...", "info");
    logToTerminal(
      `Using account: ${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`,
      "info"
    );

    try {
      const response = await fetch("/api/docker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deployContract",
          userId,
          publicKey,
        }),
      });
      const data = await response.json();

      if (data.success) {
        logToTerminal("✓ Contract deployed successfully!", "log");
        logToTerminal("=== Deployment Output ===", "info");

        // Log all output from the VM
        const output = data.output || data.stdout || "";
        const errorOutput = data.stderr || "";

        if (output) {
          output.split("\n").forEach((line: string) => {
            if (line.trim()) logToTerminal(line, "log");
          });
        }

        if (errorOutput) {
          errorOutput.split("\n").forEach((line: string) => {
            if (line.trim()) logToTerminal(line, "warn");
          });
        }
      } else {
        logToTerminal("✗ Deployment failed", "error");
        logToTerminal(`Error: ${data.error}`, "error");

        const errorDetails = data.output || data.stderr || "";
        if (errorDetails) {
          errorDetails.split("\n").forEach((line: string) => {
            if (line.trim()) logToTerminal(line, "error");
          });
        }

        onError(`Failed to deploy contract: ${data.error}`);
      }
    } catch (error) {
      logToTerminal(`✗ Failed to deploy contract: ${error}`, "error");
      onError("Failed to deploy contract");
    } finally {
      onContractLoading(false);
    }
  }, [userId, publicKey, logToTerminal, onContractLoading, onError, onTerminalOpen]);

  return {
    handleDeployContract,
  };
}


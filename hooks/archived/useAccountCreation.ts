"use client";

/**
 * Account Creation Hook (Archived)
 * 
 * This hook handles Stellar account creation for the Soroban environment.
 * Currently not in use but preserved for future implementation.
 * 
 * Reference: hooks/archived/useAccountCreation.ts
 * Status: Disabled - Awaiting backend API support
 * Last Updated: 2025-12-28
 */

import { useCallback } from "react";

interface UseAccountCreationProps {
  userId: string;
  logToTerminal: (message: string, type: "log" | "error" | "warn" | "info") => void;
  onAccountLoading: (loading: boolean) => void;
  onError: (error: string | null) => void;
  onTerminalOpen: (open: boolean) => void;
}

export function useAccountCreation({
  userId,
  logToTerminal,
  onAccountLoading,
  onError,
  onTerminalOpen,
}: UseAccountCreationProps) {
  // Create Account
  const handleCreateAccount = useCallback(async () => {
    onAccountLoading(true);
    onError(null);
    onTerminalOpen(true); // Auto-open terminal
    logToTerminal("Creating Stellar account...", "info");

    try {
      const response = await fetch("/api/docker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "createAccount", userId }),
      });
      const data = await response.json();

      if (data.success) {
        logToTerminal("✓ Account created successfully!", "log");

        // Log stdout from VM
        if (data.stdout) {
          data.stdout.split("\n").forEach((line: string) => {
            if (line.trim()) logToTerminal(line, "log");
          });
        }

        // Log stderr from VM as warnings
        if (data.stderr) {
          data.stderr.split("\n").forEach((line: string) => {
            if (line.trim()) logToTerminal(line, "warn");
          });
        }

        // Log backup message
        if (data.message) {
          logToTerminal(`✓ ${data.message}`, "log");
        }
        logToTerminal(
          "✓ Credentials backed up to soroban-hello-world/.config",
          "log"
        );
      } else {
        logToTerminal(
          `✗ Failed to create account: ${data.error}`,
          "error"
        );
        onError(`Failed to create account: ${data.error}`);
      }
    } catch (error) {
      logToTerminal(`✗ Failed to create account: ${error}`, "error");
      onError("Failed to create account");
    } finally {
      onAccountLoading(false);
    }
  }, [userId, logToTerminal, onAccountLoading, onError, onTerminalOpen]);

  return {
    handleCreateAccount,
  };
}


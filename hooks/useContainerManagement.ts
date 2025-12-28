"use client";

import { useCallback } from "react";

interface UseContainerManagementProps {
  userId: string;
  logToTerminal: (message: string, type: "log" | "error" | "warn" | "info") => void;
  onContainerLoading: (loading: boolean) => void;
  onError: (error: string | null) => void;
  onTerminalOpen: (open: boolean) => void;
  onLoadFiles: () => Promise<void>;
  onClearFiles: () => void;
}

export function useContainerManagement({
  userId,
  logToTerminal,
  onContainerLoading,
  onError,
  onTerminalOpen,
  onLoadFiles,
  onClearFiles,
}: UseContainerManagementProps) {
  // Create Container
  const handleCreateContainer = useCallback(async () => {
    onContainerLoading(true);
    onError(null);
    onTerminalOpen(true); // Auto-open terminal
    logToTerminal("Creating Docker container...", "info");

    try {
      const response = await fetch("/api/docker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", userId }),
      });

      const data = await response.json();

      if (data.success) {
        logToTerminal(`✓ ${data.message}`, "log");

        // Log any setup output
        if (data.output) {
          data.output.split("\n").forEach((line: string) => {
            if (line.trim()) logToTerminal(line, "log");
          });
        }

        await onLoadFiles();
      } else {
        logToTerminal(
          `✗ Failed to create container: ${data.error}`,
          "error"
        );
        onError(`Failed to create container: ${data.error}`);
      }
    } catch (error) {
      logToTerminal(`✗ Failed to create container: ${error}`, "error");
      onError("Failed to create container");
    } finally {
      onContainerLoading(false);
    }
  }, [userId, logToTerminal, onContainerLoading, onError, onTerminalOpen, onLoadFiles]);

  // Delete Container
  const handleDeleteContainer = useCallback(async () => {
    if (!confirm(`Delete container for user ${userId}?`)) {
      return;
    }

    onContainerLoading(true);
    onError(null);
    onTerminalOpen(true); // Auto-open terminal
    logToTerminal("Deleting Docker container...", "info");

    try {
      const response = await fetch("/api/docker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", userId }),
      });

      const data = await response.json();

      if (data.success) {
        logToTerminal(`✓ ${data.message}`, "log");
        onClearFiles();
      } else {
        logToTerminal(
          `✗ Failed to delete container: ${data.error}`,
          "error"
        );
        onError(`Failed to delete container: ${data.error}`);
      }
    } catch (error) {
      logToTerminal(`✗ Failed to delete container: ${error}`, "error");
      onError("Failed to delete container");
    } finally {
      onContainerLoading(false);
    }
  }, [userId, logToTerminal, onContainerLoading, onError, onTerminalOpen, onClearFiles]);

  return {
    handleCreateContainer,
    handleDeleteContainer,
  };
}


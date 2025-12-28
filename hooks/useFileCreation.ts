"use client";

import { useState, useCallback } from "react";

type FileNode = {
  name: string;
  type: "file" | "folder";
  path: string;
  content?: string;
  children?: FileNode[];
};

type CreationState = {
  parentPath: string;
  type: "file" | "folder";
} | null;

type LogFunction = (
  message: string,
  type: "log" | "error" | "warn" | "info"
) => void;

/**
 * Hook to manage file/folder creation UI state
 * Handles the creation dialog state and user input
 */
export function useFileCreation(
  userId: string,
  onLog: LogFunction,
  onError: (error: string | null) => void,
  onSetTerminalOpen: (open: boolean) => void,
  onLoadFiles: () => Promise<void>,
  onSetOpenFile: (file: FileNode | null) => void,
  onSetFileContents: (cb: (prev: Map<string, string>) => Map<string, string>) => void,
  onSetExpandedFolders: (cb: (prev: Set<string>) => Set<string>) => void
) {
  const [creatingItem, setCreatingItem] = useState<CreationState>(null);
  const [newItemName, setNewItemName] = useState("");

  /**
   * Start creating a new file
   */
  const handleCreateFile = useCallback((parentPath: string = "") => {
    setCreatingItem({ parentPath, type: "file" });
    setNewItemName("");
  }, []);

  /**
   * Start creating a new folder
   */
  const handleCreateFolder = useCallback((parentPath: string = "") => {
    setCreatingItem({ parentPath, type: "folder" });
    setNewItemName("");
  }, []);

  /**
   * Confirm and execute file/folder creation
   */
  const confirmCreateItem = useCallback(async () => {
    if (!creatingItem || !newItemName.trim()) {
      setCreatingItem(null);
      return;
    }

    const fileName = newItemName.trim();
    const fullPath = creatingItem.parentPath
      ? `${creatingItem.parentPath}/${fileName}`
      : fileName;

    onSetTerminalOpen(true);
    onLog(`Creating ${creatingItem.type}: ${fullPath}`, "info");

    try {
      const response = await fetch("/api/docker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: creatingItem.type === "file" ? "createFile" : "createFolder",
          userId,
          filePath: fullPath,
        }),
      });

      const data = await response.json();

      if (data.success) {
        onLog(`✓ ${creatingItem.type} created: ${fullPath}`, "log");
        await onLoadFiles();

        if (creatingItem.type === "file") {
          const newFile: FileNode = {
            name: fileName,
            type: "file",
            path: fullPath,
          };
          onSetFileContents((prev) => new Map(prev).set(fullPath, ""));
          onSetOpenFile(newFile);
        } else {
          onSetExpandedFolders((prev) => new Set(prev).add(fullPath));
        }

        setCreatingItem(null);
        setNewItemName("");
      } else {
        onLog(
          `✗ Failed to create ${creatingItem.type}: ${data.error}`,
          "error"
        );
        onError(`Failed to create ${creatingItem.type}: ${data.error}`);
        setCreatingItem(null);
      }
    } catch (error) {
      onLog(
        `✗ Failed to create ${creatingItem.type}: ${error}`,
        "error"
      );
      onError(`Failed to create ${creatingItem.type}`);
      setCreatingItem(null);
    }
  }, [creatingItem, newItemName, userId, onLog, onError, onSetTerminalOpen, onLoadFiles, onSetOpenFile, onSetFileContents, onSetExpandedFolders]);

  /**
   * Cancel file/folder creation
   */
  const cancelCreateItem = useCallback(() => {
    setCreatingItem(null);
    setNewItemName("");
  }, []);

  return {
    creatingItem,
    newItemName,
    setNewItemName,
    handleCreateFile,
    handleCreateFolder,
    confirmCreateItem,
    cancelCreateItem,
  };
}


"use client";

import { useCallback } from "react";

type FileNode = {
  name: string;
  type: "file" | "folder";
  path: string;
  content?: string;
  children?: FileNode[];
};

type LogFunction = (
  message: string,
  type: "log" | "error" | "warn" | "info"
) => void;

/**
 * Hook to manage file loading and deletion operations
 * Handles API calls for loading file tree and deleting files/folders
 */
export function useFileOperations(
  userId: string,
  onLog: LogFunction,
  onError: (error: string | null) => void,
  onSetTerminalOpen: (open: boolean) => void,
  buildFileTree: (flatFiles: string[]) => FileNode[]
) {
  /**
   * Load files from container and build tree
   * @param preserveExpanded Whether to preserve current expanded folders
   * @param onSetFiles Callback to update files state
   * @param onSetExpandedFolders Callback to update expanded folders state
   */
  const loadFiles = useCallback(
    async (
      preserveExpanded: boolean,
      onSetFiles: (files: FileNode[]) => void,
      onSetExpandedFolders: (cb: (prev: Set<string>) => Set<string>) => void
    ) => {
      onError(null);
      try {
        const response = await fetch("/api/docker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "getFiles", userId }),
        });
        const data = await response.json();

        if (data.success && data.files) {
          const tree = buildFileTree(data.files);
          onSetFiles(tree);

          if (!preserveExpanded) {
            const commonFolders = ["src", "contracts", "soroban-hello-world"];
            onSetExpandedFolders(() => new Set(commonFolders));
          }
        } else {
          onError(data.error || "Failed to load files");
          onSetFiles([]);
        }
      } catch (error) {
        console.error("Failed to load files:", error);
        onError("Failed to connect to server");
        onSetFiles([]);
      }
    },
    [userId, onError, buildFileTree]
  );

  /**
   * Delete a file from container
   * @param filePath Path of the file to delete
   * @param openFile Currently open file (to check if we need to close it)
   * @param onLoadFiles Callback to reload files after deletion
   * @param onSetOpenFile Callback to update open file
   * @param onSetFileContents Callback to update file contents cache
   */
  const handleDeleteFile = useCallback(
    async (
      filePath: string,
      openFile: FileNode | null,
      onLoadFiles: () => Promise<void>,
      onSetOpenFile: (file: FileNode | null) => void,
      onSetFileContents: (cb: (prev: Map<string, string>) => Map<string, string>) => void
    ) => {
      if (!confirm(`Delete file: ${filePath}?`)) {
        return;
      }

      onSetTerminalOpen(true);
      onLog(`Deleting ${filePath}...`, "info");

      try {
        const response = await fetch("/api/docker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "deleteFile",
            userId,
            filePath,
          }),
        });

        const data = await response.json();

        if (data.success) {
          onLog(`✓ File deleted: ${filePath}`, "log");
          if (openFile?.path === filePath) {
            onSetOpenFile(null);
          }
          onSetFileContents((prev) => {
            const newContents = new Map(prev);
            newContents.delete(filePath);
            return newContents;
          });
          await onLoadFiles();
        } else {
          onLog(`✗ Failed to delete file: ${data.error}`, "error");
          onError(`Failed to delete file: ${data.error}`);
        }
      } catch (error) {
        onLog(`✗ Failed to delete file: ${error}`, "error");
        onError("Failed to delete file");
      }
    },
    [userId, onLog, onError, onSetTerminalOpen]
  );

  /**
   * Delete a folder and all its contents from container
   * @param folderPath Path of the folder to delete
   * @param openFile Currently open file (to check if it's in the folder)
   * @param onLoadFiles Callback to reload files after deletion
   * @param onSetOpenFile Callback to update open file
   * @param onSetExpandedFolders Callback to update expanded folders
   */
  const handleDeleteFolder = useCallback(
    async (
      folderPath: string,
      openFile: FileNode | null,
      onLoadFiles: () => Promise<void>,
      onSetOpenFile: (file: FileNode | null) => void,
      onSetExpandedFolders: (cb: (prev: Set<string>) => Set<string>) => void
    ) => {
      if (!confirm(`Delete folder and all contents: ${folderPath}?`)) {
        return;
      }

      onSetTerminalOpen(true);
      onLog(`Deleting folder ${folderPath}...`, "info");

      try {
        const response = await fetch("/api/docker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "deleteFolder",
            userId,
            filePath: folderPath,
          }),
        });

        const data = await response.json();

        if (data.success) {
          onLog(`✓ Folder deleted: ${folderPath}`, "log");
          if (openFile?.path.startsWith(folderPath)) {
            onSetOpenFile(null);
          }
          onSetExpandedFolders((prev) => {
            const newExpanded = new Set(prev);
            newExpanded.delete(folderPath);
            return newExpanded;
          });
          await onLoadFiles();
        } else {
          onLog(`✗ Failed to delete folder: ${data.error}`, "error");
          onError(`Failed to delete folder: ${data.error}`);
        }
      } catch (error) {
        onLog(`✗ Failed to delete folder: ${error}`, "error");
        onError("Failed to delete folder");
      }
    },
    [userId, onLog, onError, onSetTerminalOpen]
  );

  return {
    loadFiles,
    handleDeleteFile,
    handleDeleteFolder,
  };
}


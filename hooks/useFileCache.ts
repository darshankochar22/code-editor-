"use client";

import { useState, useCallback } from "react";

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
 * Hook to manage file content caching and file opening
 * Handles loading file content from API and caching it
 */
export function useFileCache(
  userId: string,
  onLog: LogFunction,
  onError: (error: string | null) => void
) {
  const [fileContents, setFileContents] = useState<Map<string, string>>(
    new Map()
  );
  const [openFile, setOpenFile] = useState<FileNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  /**
   * Load file content from container via API
   * Caches content to avoid repeated API calls
   * @param file The file to open/load
   */
  const handleFileClick = useCallback(
    async (file: FileNode) => {
      if (file.type === "file") {
        // Check if already cached
        if (fileContents.has(file.path)) {
          setOpenFile(file);
          return;
        }

        setIsLoading(true);
        try {
          const response = await fetch("/api/docker", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "getFileContent",
              userId,
              filePath: file.path,
            }),
          });
          const data = await response.json();

          if (data.success) {
            setFileContents((prev) =>
              new Map(prev).set(file.path, data.content)
            );
            setOpenFile(file);
            onError(null);
          } else {
            onError(`Failed to load ${file.name}: ${data.error}`);
          }
        } catch (error) {
          console.error("Failed to load file:", error);
          onError(`Failed to load ${file.name}`);
        } finally {
          setIsLoading(false);
        }
      }
    },
    [fileContents, userId, onError]
  );

  /**
   * Save currently open file content to container
   */
  const handleSave = useCallback(async () => {
    if (!openFile) return;

    setIsSaving(true);
    onError(null);
    onLog(`Saving ${openFile.name}...`, "info");

    try {
      const content = fileContents.get(openFile.path) || "";
      const response = await fetch("/api/docker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "saveFileContent",
          userId,
          filePath: openFile.path,
          content,
        }),
      });

      const data = await response.json();

      if (data.success) {
        onLog(`✓ ${openFile.name} saved successfully`, "log");
        setTimeout(() => onError(null), 2000);
      } else {
        onLog(
          `✗ Failed to save ${openFile.name}: ${data.error}`,
          "error"
        );
        onError(`Failed to save: ${data.error}`);
      }
    } catch (error) {
      onLog(`✗ Failed to save ${openFile.name}: ${error}`, "error");
      onError("Failed to save file");
    } finally {
      setIsSaving(false);
    }
  }, [openFile, fileContents, userId, onLog, onError]);

  return {
    fileContents,
    openFile,
    isLoading,
    isSaving,
    setFileContents,
    setOpenFile,
    handleFileClick,
    handleSave,
  };
}


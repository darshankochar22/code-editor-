"use client";

import { useState, useCallback, useEffect } from "react";

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

interface UseFileManagerReturn {
  files: FileNode[];
  openFile: FileNode | null;
  fileContents: Map<string, string>;
  expandedFolders: Set<string>;
  creatingItem: CreationState;
  newItemName: string;
  isLoading: boolean;
  isSaving: boolean;
  loadFiles: (preserveExpanded?: boolean) => Promise<void>;
  handleFileClick: (file: FileNode) => Promise<void>;
  handleSave: () => Promise<void>;
  handleCreateFile: (parentPath: string) => void;
  handleCreateFolder: (parentPath: string) => void;
  confirmCreateItem: () => Promise<void>;
  cancelCreateItem: () => void;
  handleDeleteFile: (filePath: string) => Promise<void>;
  handleDeleteFolder: (folderPath: string) => Promise<void>;
  toggleFolder: (path: string) => void;
  setNewItemName: (name: string) => void;
  setOpenFile: (file: FileNode | null) => void;
  setFileContents: (contents: Map<string, string>) => void;
  setTerminalOpen: (open: boolean) => void;
}

export function useFileManager(
  userId: string,
  onLog: LogFunction,
  onError: (error: string | null) => void,
  onSetTerminalOpen: (open: boolean) => void
): UseFileManagerReturn {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [openFile, setOpenFile] = useState<FileNode | null>(null);
  const [fileContents, setFileContents] = useState<Map<string, string>>(
    new Map()
  );
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(["src"])
  );
  const [creatingItem, setCreatingItem] = useState<CreationState>(null);
  const [newItemName, setNewItemName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  function buildFileTree(flatFiles: string[]): FileNode[] {
    type TreeNode = FileNode & { _children?: { [key: string]: TreeNode } };
    const root: { [key: string]: TreeNode } = {};

    flatFiles.forEach((filePath) => {
      const parts = filePath.split("/").filter((p) => p.length > 0);
      let currentLevel = root;

      parts.forEach((part, index) => {
        if (!currentLevel[part]) {
          const isFile = index === parts.length - 1;
          const fullPath = parts.slice(0, index + 1).join("/");

          currentLevel[part] = {
            name: part,
            type: isFile ? "file" : "folder",
            path: fullPath,
            children: isFile ? undefined : [],
            _children: isFile ? undefined : {},
          };
        }

        if (!parts[index + 1]) return;

        const node = currentLevel[part];
        if (!node._children) {
          node._children = {};
        }
        currentLevel = node._children;
      });
    });

    function convertToArray(nodeMap: { [key: string]: TreeNode }): FileNode[] {
      return Object.values(nodeMap)
        .sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === "folder" ? -1 : 1;
        })
        .map((node) => {
          const result: FileNode = {
            name: node.name,
            type: node.type,
            path: node.path,
          };

          if (node.type === "folder" && node._children) {
            result.children = convertToArray(node._children);
          }

          return result;
        });
    }

    return convertToArray(root);
  }

  const loadFiles = useCallback(
    async (preserveExpanded = true) => {
      setIsLoading(true);
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
          setFiles(tree);

          if (!preserveExpanded) {
            const commonFolders = ["src", "contracts", "soroban-hello-world"];
            setExpandedFolders(new Set(commonFolders));
          }
        } else {
          onError(data.error || "Failed to load files");
          setFiles([]);
        }
      } catch (error) {
        console.error("Failed to load files:", error);
        onError("Failed to connect to server");
        setFiles([]);
      } finally {
        setIsLoading(false);
      }
    },
    [userId, onError]
  );

  // Load files on mount
  useEffect(() => {
    const initializeFiles = async () => {
      await loadFiles(false);
    };
    initializeFiles();
  }, [userId, loadFiles]);

  const handleFileClick = useCallback(
    async (file: FileNode) => {
      if (file.type === "file") {
        if (fileContents.has(file.path)) {
          setOpenFile(file);
          return;
        }

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
        }
      }
    },
    [fileContents, userId, onError]
  );

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

  const handleCreateFile = useCallback((parentPath: string = "") => {
    setCreatingItem({ parentPath, type: "file" });
    setNewItemName("");
  }, []);

  const handleCreateFolder = useCallback((parentPath: string = "") => {
    setCreatingItem({ parentPath, type: "folder" });
    setNewItemName("");
  }, []);

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
        await loadFiles();

        if (creatingItem.type === "file") {
          const newFile: FileNode = {
            name: fileName,
            type: "file",
            path: fullPath,
          };
          setFileContents((prev) => new Map(prev).set(fullPath, ""));
          setOpenFile(newFile);
        } else {
          setExpandedFolders((prev) => new Set(prev).add(fullPath));
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
  }, [creatingItem, newItemName, userId, onLog, onError, onSetTerminalOpen, loadFiles]);

  const cancelCreateItem = useCallback(() => {
    setCreatingItem(null);
    setNewItemName("");
  }, []);

  const handleDeleteFile = useCallback(
    async (filePath: string) => {
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
            setOpenFile(null);
          }
          setFileContents((prev) => {
            const newContents = new Map(prev);
            newContents.delete(filePath);
            return newContents;
          });
          await loadFiles();
        } else {
          onLog(`✗ Failed to delete file: ${data.error}`, "error");
          onError(`Failed to delete file: ${data.error}`);
        }
      } catch (error) {
        onLog(`✗ Failed to delete file: ${error}`, "error");
        onError("Failed to delete file");
      }
    },
    [userId, openFile, onLog, onError, onSetTerminalOpen, loadFiles]
  );

  const handleDeleteFolder = useCallback(
    async (folderPath: string) => {
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
            setOpenFile(null);
          }
          setExpandedFolders((prev) => {
            const newExpanded = new Set(prev);
            newExpanded.delete(folderPath);
            return newExpanded;
          });
          await loadFiles();
        } else {
          onLog(`✗ Failed to delete folder: ${data.error}`, "error");
          onError(`Failed to delete folder: ${data.error}`);
        }
      } catch (error) {
        onLog(`✗ Failed to delete folder: ${error}`, "error");
        onError("Failed to delete folder");
      }
    },
    [userId, openFile, onLog, onError, onSetTerminalOpen, loadFiles]
  );

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  return {
    files,
    openFile,
    fileContents,
    expandedFolders,
    creatingItem,
    newItemName,
    isLoading,
    isSaving,
    loadFiles,
    handleFileClick,
    handleSave,
    handleCreateFile,
    handleCreateFolder,
    confirmCreateItem,
    cancelCreateItem,
    handleDeleteFile,
    handleDeleteFolder,
    toggleFolder,
    setNewItemName,
    setOpenFile,
    setFileContents,
    setTerminalOpen: onSetTerminalOpen,
  };
}


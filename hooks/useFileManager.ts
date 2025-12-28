"use client";

import { useEffect, useCallback, useRef } from "react";
import { useFileTree } from "./useFileTree";
import { useFileCache } from "./useFileCache";
import { useFileCreation } from "./useFileCreation";
import { useFileOperations } from "./useFileOperations";

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

interface UseFileManagerReturn {
  files: FileNode[];
  openFile: FileNode | null;
  fileContents: Map<string, string>;
  expandedFolders: Set<string>;
  creatingItem: { parentPath: string; type: "file" | "folder" } | null;
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
  setFiles: (files: FileNode[]) => void;
}

/**
 * Composite hook combining file tree, cache, creation, and operations
 * Provides unified interface for all file management functionality
 */
export function useFileManager(
  userId: string,
  onLog: LogFunction,
  onError: (error: string | null) => void,
  onSetTerminalOpen: (open: boolean) => void
): UseFileManagerReturn {
  // File tree management
  const {
    files,
    expandedFolders,
    setFiles,
    setExpandedFolders,
    buildFileTree,
    toggleFolder,
  } = useFileTree();

  // File content caching
  const {
    fileContents,
    openFile,
    isLoading,
    isSaving,
    setFileContents,
    setOpenFile,
    handleFileClick,
    handleSave,
  } = useFileCache(userId, onLog, onError);

  // File operations (load, delete)
  const { loadFiles: loadFilesImpl, handleDeleteFile: deleteFileImpl, handleDeleteFolder: deleteFolderImpl } = useFileOperations(
    userId,
    onLog,
    onError,
    onSetTerminalOpen,
    buildFileTree
  );

  // Wrapper for loadFiles to match expected signature
  const loadFilesWrapper = useCallback(
    async (preserveExpanded = true) => {
      await loadFilesImpl(preserveExpanded, setFiles, setExpandedFolders);
    },
    [loadFilesImpl, setFiles, setExpandedFolders]
  );

  // File/folder creation
  const {
    creatingItem,
    newItemName,
    setNewItemName,
    handleCreateFile,
    handleCreateFolder,
    confirmCreateItem,
    cancelCreateItem,
  } = useFileCreation(
    userId,
    onLog,
    onError,
    onSetTerminalOpen,
    loadFilesWrapper,
    setOpenFile,
    setFileContents,
    setExpandedFolders
  );

  // Wrapper for handleDeleteFile to pass required callbacks
  const handleDeleteFile = useCallback(
    async (filePath: string) => {
      await deleteFileImpl(
        filePath,
        openFile,
        loadFilesWrapper,
        setOpenFile,
        setFileContents
      );
    },
    [deleteFileImpl, openFile, loadFilesWrapper, setOpenFile, setFileContents]
  );

  // Wrapper for handleDeleteFolder to pass required callbacks
  const handleDeleteFolder = useCallback(
    async (folderPath: string) => {
      await deleteFolderImpl(
        folderPath,
        openFile,
        loadFilesWrapper,
        setOpenFile,
        setExpandedFolders
      );
    },
    [deleteFolderImpl, openFile, loadFilesWrapper, setOpenFile, setExpandedFolders]
  );

  // Load files on mount (only once per userId)
  const hasInitialized = useRef(false);
  
  useEffect(() => {
    if (hasInitialized.current) return;
    
    hasInitialized.current = true;
    
    const initializeFiles = async () => {
      await loadFilesWrapper(false);
    };
    initializeFiles();
  }, [userId, loadFilesWrapper]);

  return {
    files,
    openFile,
    fileContents,
    expandedFolders,
    creatingItem,
    newItemName,
    isLoading,
    isSaving,
    loadFiles: loadFilesWrapper,
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
    setFiles,
  };
}


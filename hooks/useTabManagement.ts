"use client";

import { useState, useCallback } from "react";
import type { OpenFile } from "@/components/TabBar";

type FileNode = {
  name: string;
  type: "file" | "folder";
  path: string;
  content?: string;
  children?: FileNode[];
};

interface UseTabManagementProps {
  files: FileNode[];
  onFileSelect: (file: FileNode) => void;
  onOpenFilesChange: (files: OpenFile[]) => void;
}

export function useTabManagement({
  files,
  onFileSelect,
  onOpenFilesChange,
}: UseTabManagementProps) {
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [currentOpenFile, setCurrentOpenFile] = useState<FileNode | null>(null);

  // Find file node in tree
  const findFileNode = useCallback(
    (path: string): FileNode | null => {
      const search = (nodes: FileNode[]): FileNode | null => {
        for (const node of nodes) {
          if (node.path === path) return node;
          if (node.children) {
            const found = search(node.children);
            if (found) return found;
          }
        }
        return null;
      };
      return search(files);
    },
    [files]
  );

  // Add file to open files
  const addOpenFile = useCallback(
    (file: FileNode) => {
      setOpenFiles((prev) => {
        const exists = prev.find((f) => f.path === file.path);
        if (!exists && file.type === "file") {
          const newFiles = [
            ...prev,
            { path: file.path, name: file.name, isDirty: false },
          ];
          onOpenFilesChange(newFiles);
          return newFiles;
        }
        onOpenFilesChange(prev);
        return prev;
      });
    },
    [onOpenFilesChange]
  );

  // Select tab
  const handleSelectTab = useCallback(
    (path: string) => {
      const file = openFiles.find((f) => f.path === path);
      if (file) {
        const fileNode = findFileNode(path);
        if (fileNode) {
          setCurrentOpenFile(fileNode);
          onFileSelect(fileNode);
        }
      }
    },
    [openFiles, findFileNode, onFileSelect]
  );

  // Close tab
  const handleCloseTab = useCallback(
    (path: string) => {
      setOpenFiles((prev) => {
        const filtered = prev.filter((f) => f.path !== path);
        onOpenFilesChange(filtered);

        // If the closed file was active, switch to another file
        if (currentOpenFile?.path === path) {
          if (filtered.length > 0) {
            const nextFile = findFileNode(
              filtered[filtered.length - 1].path
            );
            if (nextFile) {
              setCurrentOpenFile(nextFile);
              onFileSelect(nextFile);
            }
          } else {
            setCurrentOpenFile(null);
          }
        }

        return filtered;
      });
    },
    [currentOpenFile, findFileNode, onFileSelect, onOpenFilesChange]
  );

  return {
    openFiles,
    setOpenFiles,
    currentOpenFile,
    setCurrentOpenFile,
    addOpenFile,
    handleSelectTab,
    handleCloseTab,
    findFileNode,
  };
}


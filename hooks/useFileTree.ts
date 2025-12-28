"use client";

import { useState, useCallback } from "react";

type FileNode = {
  name: string;
  type: "file" | "folder";
  path: string;
  content?: string;
  children?: FileNode[];
};

/**
 * Hook to manage file tree structure and folder expansion state
 * Handles building the tree from flat file list and tracking expanded folders
 */
export function useFileTree() {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(["src"])
  );

  /**
   * Build hierarchical file tree from flat file list
   * @param flatFiles Array of file paths like "src/main.rs", "src/lib/utils.rs"
   * @returns Hierarchical FileNode tree structure
   */
  const buildFileTree = useCallback((flatFiles: string[]): FileNode[] => {
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
  }, []);

  /**
   * Toggle folder expansion state
   * @param path The folder path to toggle
   */
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
    expandedFolders,
    setFiles,
    setExpandedFolders,
    buildFileTree,
    toggleFolder,
  };
}


"use client";

import { useCallback } from "react";
import type { OpenFile } from "@/components/TabBar";

type FileNode = {
  name: string;
  type: "file" | "folder";
  path: string;
  content?: string;
  children?: FileNode[];
};

interface UseEditorStateProps {
  openFile: FileNode | null;
  fileContents: Map<string, string>;
  onFileContentsChange: (contents: Map<string, string>) => void;
  onOpenFilesChange: (updater: (prev: OpenFile[]) => OpenFile[]) => void;
}

export function useEditorState({
  openFile,
  fileContents,
  onFileContentsChange,
  onOpenFilesChange,
}: UseEditorStateProps) {
  // Handle editor content change
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (openFile && value !== undefined) {
        const newContents = new Map(fileContents);
        newContents.set(openFile.path, value);
        onFileContentsChange(newContents);

        // Mark file as dirty in the tab bar
        onOpenFilesChange((prev) =>
          prev.map((f) =>
            f.path === openFile.path ? { ...f, isDirty: true } : f
          )
        );
      }
    },
    [openFile, fileContents, onFileContentsChange, onOpenFilesChange]
  );

  return {
    handleEditorChange,
  };
}


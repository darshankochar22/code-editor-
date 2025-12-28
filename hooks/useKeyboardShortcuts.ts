"use client";

import { useEffect } from "react";
import type { editor } from "monaco-editor";

interface UseKeyboardShortcutsProps {
  onSave: () => void;
  fontSize: number;
  onFontSizeChange: (fontSize: number) => void;
  editorRef: React.RefObject<editor.IStandaloneCodeEditor | null>;
}

export function useKeyboardShortcuts({
  onSave,
  fontSize,
  onFontSizeChange,
  editorRef,
}: UseKeyboardShortcutsProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Save: CMD/CTRL + S
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        onSave();
      }

      // Zoom In: CMD/CTRL + = or CMD/CTRL + SHIFT + I
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === "+" || e.key === "=" || (e.shiftKey && e.key === "i"))
      ) {
        e.preventDefault();
        const newFontSize = Math.min(fontSize + 2, 40);
        onFontSizeChange(newFontSize);
        if (editorRef.current) {
          editorRef.current.updateOptions({ fontSize: newFontSize });
        }
      }

      // Zoom Out: CMD/CTRL + - or CMD/CTRL + SHIFT + -
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === "-" || e.key === "_" || (e.shiftKey && e.key === "-"))
      ) {
        e.preventDefault();
        const newFontSize = Math.max(fontSize - 2, 8);
        onFontSizeChange(newFontSize);
        if (editorRef.current) {
          editorRef.current.updateOptions({ fontSize: newFontSize });
        }
      }

      // Reset Zoom: CMD/CTRL + 0
      if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault();
        onFontSizeChange(14);
        if (editorRef.current) {
          editorRef.current.updateOptions({ fontSize: 14 });
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fontSize, onSave, onFontSizeChange, editorRef]);
}


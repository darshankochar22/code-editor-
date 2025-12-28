"use client";

import { useEffect, useRef, useCallback } from "react";
import type { editor } from "monaco-editor";

interface MonacoLanguages {
  typescript?: {
    typescriptDefaults?: {
      setCompilerOptions: (options: unknown) => void;
    };
    ScriptTarget?: { ES2020: number };
    ModuleResolutionKind?: { NodeJs: number };
    ModuleKind?: { ESNext: number };
    JsxEmit?: { React: number };
  };
}

type MonacoType = {
  languages?: MonacoLanguages;
};

interface UseMonacoSetupProps {
  onFontSizeChange: (fontSize: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useMonacoSetup({
  onFontSizeChange,
  containerRef,
}: UseMonacoSetupProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const wheelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedDeltaRef = useRef(0);

  // Setup Monaco CSS styles
  useEffect(() => {
    const styleId = "monaco-custom-styles";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .monaco-editor .focused .selected-text,
        .monaco-editor .view-line,
        .monaco-editor .margin,
        .monaco-editor,
        .monaco-editor-background,
        .monaco-editor .inputarea.ime-input {
          outline: none !important;
          border: none !important;
        }
        .monaco-editor .view-lines,
        .monaco-editor .margin-view-overlays,
        .monaco-editor .cursors-layer,
        .monaco-editor .lines-content,
        .monaco-editor .view-line span {
          outline: none !important;
        }
        .monaco-editor .selected-text {
          border: none !important;
        }
        .monaco-editor:focus,
        .monaco-editor.focused {
          outline: none !important;
          border: none !important;
        }
      `;
      document.head.appendChild(style);
    }
    return () => {
      const styleElement = document.getElementById(styleId);
      if (styleElement) styleElement.remove();
    };
  }, []);

  // Handle mouse wheel zoom
  const handleMouseWheel = useCallback(
    (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        if (editorRef.current) {
          accumulatedDeltaRef.current += event.deltaY;

          if (wheelTimeoutRef.current) {
            clearTimeout(wheelTimeoutRef.current);
          }

          wheelTimeoutRef.current = setTimeout(() => {
            const editor = editorRef.current;
            if (!editor) return;

            const currentFontSize =
              (editor.getOption(55) as unknown as number) || 14;
            const normalizedDelta = accumulatedDeltaRef.current / 100;
            const zoomDelta = Math.round(normalizedDelta);

            if (zoomDelta !== 0) {
              const newFontSize = Math.max(
                8,
                Math.min(40, currentFontSize - zoomDelta)
              );
              if (newFontSize !== currentFontSize) {
                onFontSizeChange(newFontSize);
                editor.updateOptions({ fontSize: newFontSize });
              }
            }

            accumulatedDeltaRef.current = 0;
          }, 50);
        }
      }
    },
    [onFontSizeChange]
  );

  // Handle editor mount and configure Monaco
  const handleEditorDidMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor, monaco: unknown): void => {
      editorRef.current = editorInstance;
      editorInstance.focus();

      const typedMonaco = monaco as MonacoType;
      if (typedMonaco && typedMonaco.languages) {
        typedMonaco.languages.typescript?.typescriptDefaults?.setCompilerOptions({
          target: 99, // ES2020
          allowNonTsExtensions: true,
          moduleResolution: 99, // NodeJs
          module: 99, // ESNext
          noEmit: true,
          esModuleInterop: true,
          jsx: 4, // React
          allowJs: true,
          skipLibCheck: true,
          strict: false,
        });
      }

      if (containerRef.current) {
        containerRef.current.addEventListener("wheel", handleMouseWheel, {
          passive: false,
        });
      }
    },
    [handleMouseWheel, containerRef]
  );

  // Cleanup wheel event listener
  useEffect(() => {
    const container = containerRef.current;
    return () => {
      if (container) {
        container.removeEventListener("wheel", handleMouseWheel);
      }
      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current);
      }
    };
  }, [handleMouseWheel, containerRef]);

  return {
    editorRef,
    handleEditorDidMount,
  };
}


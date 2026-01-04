"use client";

import { useRef, useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import Terminal, { type LogMessage } from "./Terminal";
import TabBar, { type OpenFile } from "./TabBar";
import BottomBar from "./BottomBar";

type MonacoType = any;

type FileNode = {
  name: string;
  type: "file" | "folder";
  path: string;
  content?: string;
  children?: FileNode[];
};

interface EditorPanelProps {
  openFile: FileNode | null;
  openFiles: OpenFile[];
  fileContents: Map<string, string>;
  fontSize: number;
  terminalOpen: boolean;
  terminalHeight: number;
  logs: LogMessage[];
  onFileSelect: (path: string) => void;
  onFileClose: (path: string) => void;
  onEditorChange: (value: string | undefined) => void;
  onEditorMount: (
    editorInstance: editor.IStandaloneCodeEditor,
    monaco: MonacoType
  ) => void;
  onSave: () => void;
  onTerminalClose: () => void;
  onTerminalHeightChange: (height: number) => void;
}

// LSP State
let lspClient: any = null;
let isLSPInitialized = false;

export default function EditorPanel({
  openFile,
  openFiles,
  fileContents,
  fontSize,
  terminalOpen,
  terminalHeight,
  logs,
  onFileSelect,
  onFileClose,
  onEditorChange,
  onEditorMount,
  onTerminalClose,
  onTerminalHeightChange,
}: EditorPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wheelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedDeltaRef = useRef(0);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<MonacoType | null>(null);
  
  // LSP Status
  const [lspStatus, setLspStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  const handleMouseWheel = (event: WheelEvent) => {
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
              editorRef.current?.updateOptions({ fontSize: newFontSize });
            }
          }

          accumulatedDeltaRef.current = 0;
        }, 50);
      }
    }
  };

  // Initialize LSP
  async function initializeLSP(monaco: MonacoType, editorInstance: editor.IStandaloneCodeEditor) {
    if (isLSPInitialized) {
      console.log('[LSP] Already initialized');
      return;
    }

    console.log('[LSP] Starting initialization...');
    setLspStatus('connecting');

    try {
      const { MonacoLanguageClient } = await import('monaco-languageclient');
      const { CloseAction, ErrorAction } = await import('vscode-languageclient');
      const { listen } = await import('vscode-ws-jsonrpc');

      console.log('[LSP] Creating WebSocket connection to ws://localhost:3001...');
      const webSocket = new WebSocket('ws://localhost:3001');

      // Wait for WebSocket to open
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error('[LSP] Connection timeout after 10 seconds');
          reject(new Error('Connection timeout'));
        }, 10000);
        
        webSocket.onopen = () => {
          clearTimeout(timeout);
          console.log('[LSP] WebSocket connected successfully');
          resolve();
        };
        
        webSocket.onerror = (error) => {
          clearTimeout(timeout);
          console.error('[LSP] WebSocket error:', error);
          reject(error);
        };
      });

      console.log('[LSP] WebSocket ready, setting up language client...');

      listen({
        webSocket,
        onConnection: (connection) => {
          console.log('[LSP] Connection established');

          const client = new MonacoLanguageClient({
            name: 'Rust Language Client',
            clientOptions: {
              documentSelector: [{ language: 'rust' }],
              workspaceFolder: {
                uri: monaco.Uri.parse('file:///workspace'),
                name: 'workspace',
                index: 0
              },
              errorHandler: {
                error: () => ({ action: ErrorAction.Continue }),
                closed: () => {
                  console.log('[LSP] Connection closed');
                  isLSPInitialized = false;
                  setLspStatus('disconnected');
                  return { action: CloseAction.DoNotRestart };
                }
              },
              synchronize: {
                fileEvents: []
              },
              initializationOptions: {
                cargo: {
                  allFeatures: true,
                  loadOutDirsFromCheck: true
                },
                checkOnSave: {
                  command: 'clippy',
                  allTargets: true
                },
                procMacro: {
                  enable: true
                },
                completion: {
                  autoimport: {
                    enable: true
                  },
                  autoself: {
                    enable: true
                  }
                },
                inlayHints: {
                  enable: true
                }
              }
            },
            connectionProvider: {
              get: async () => connection
            }
          });

          connection.onError((error) => {
            console.error('[LSP] Connection error:', error);
          });

          connection.onClose(() => {
            console.log('[LSP] Connection closed');
            isLSPInitialized = false;
            setLspStatus('disconnected');
            if (lspClient) {
              lspClient.stop();
              lspClient = null;
            }
          });

          console.log('[LSP] Starting language client...');
          client.start();
          lspClient = client;
          isLSPInitialized = true;
          setLspStatus('connected');
          console.log('[LSP] ✅ Language client started successfully');

          // Setup keyboard shortcuts
          editorInstance.addCommand(
            monaco.KeyMod.Alt | monaco.KeyCode.F8,
            () => editorInstance.trigger('keyboard', 'editor.action.marker.next', null)
          );

          editorInstance.addCommand(
            monaco.KeyMod.Alt | monaco.KeyMod.Shift | monaco.KeyCode.F8,
            () => editorInstance.trigger('keyboard', 'editor.action.marker.prev', null)
          );
        }
      });

    } catch (error) {
      console.error('[LSP] Failed to initialize:', error);
      setLspStatus('disconnected');
      isLSPInitialized = false;
    }
  }

  function handleEditorDidMount(
    editorInstance: editor.IStandaloneCodeEditor,
    monaco: MonacoType
  ) {
    editorRef.current = editorInstance;
    monacoRef.current = monaco;
    editorInstance.focus();

    if (containerRef.current) {
      containerRef.current.addEventListener("wheel", handleMouseWheel, {
        passive: false,
      });
    }

    // Call parent's onEditorMount
    onEditorMount(editorInstance, monaco);

    // Initialize LSP
    initializeLSP(monaco, editorInstance);

    return () => {
      if (containerRef.current) {
        containerRef.current.removeEventListener("wheel", handleMouseWheel);
      }
      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current);
      }
    };
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (lspClient) {
        console.log('[LSP] Stopping client...');
        lspClient.stop();
        lspClient = null;
        isLSPInitialized = false;
      }
    };
  }, []);

  function getFileContent(file: FileNode | null): string {
    if (!file) return "";
    return fileContents.get(file.path) ?? "";
  }

  function getLanguage(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase();
    const languageMap: { [key: string]: string } = {
      rs: "rust",
      toml: "toml",
      json: "json",
      md: "markdown",
      js: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      html: "html",
      css: "css",
      scss: "scss",
      yaml: "yaml",
      yml: "yaml",
      sh: "shell",
      py: "python",
    };
    return languageMap[ext || ""] || "plaintext";
  }

  const isRustFile = openFile?.name.endsWith('.rs');

  return (
    <div className="flex-1 bg-[#171717] flex flex-col" ref={containerRef}>
      {/* Tab Bar */}
      <TabBar
        openFiles={openFiles}
        activeFile={openFile?.path || null}
        onSelectFile={onFileSelect}
        onCloseFile={onFileClose}
      />

      {/* LSP Status Bar - Only show for Rust files */}
      {isRustFile && (
        <div className="h-6 bg-[#007acc] text-white text-xs flex items-center px-3 gap-2">
          <span className="font-medium">LSP:</span>
          {lspStatus === 'connected' && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              Connected ✓
            </span>
          )}
          {lspStatus === 'connecting' && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
              Connecting...
            </span>
          )}
          {lspStatus === 'disconnected' && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-red-400 rounded-full"></span>
              Disconnected
            </span>
          )}
          <span className="ml-auto text-[10px] opacity-75">Alt+F8: Next Error | Alt+Shift+F8: Prev Error</span>
        </div>
      )}

      {/* Editor Area with Terminal */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-hidden">
          {openFile ? (
            <Editor
              height="100%"
              language={getLanguage(openFile.name)}
              theme="vs-dark"
              value={getFileContent(openFile)}
              onChange={onEditorChange}
              onMount={handleEditorDidMount}
              options={{
                fontSize: fontSize,
                fontFamily:
                  "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'Monaco', monospace",
                minimap: { enabled: true },
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: "on",
                formatOnPaste: true,
                formatOnType: true,
                insertSpaces: true,
                suggestOnTriggerCharacters: true,
                acceptSuggestionOnEnter: "on",
                quickSuggestions: {
                  other: true,
                  comments: false,
                  strings: false
                },
                parameterHints: { 
                  enabled: true,
                  cycle: true
                },
                folding: true,
                renderWhitespace: "selection",
                cursorBlinking: "smooth",
                cursorSmoothCaretAnimation: "on",
                smoothScrolling: true,
                padding: { top: 16 },
                scrollbar: {
                  vertical: "visible",
                  horizontal: "visible",
                  useShadows: true,
                  verticalSliderSize: 12,
                  horizontalSliderSize: 12,
                },
                renderLineHighlight: "all",
                overviewRulerBorder: false,
                hideCursorInOverviewRuler: false,
                // Enhanced LSP features
                hover: {
                  enabled: true,
                  delay: 300
                },
                codeLens: true,
                lightbulb: {
                  enabled: "on" as const
                },
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <div className="text-6xl mb-4">📁</div>
                <p className="text-lg mb-2">No file selected</p>
                <p className="text-sm">
                  Open a file from the sidebar to start editing
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Terminal */}
        {terminalOpen && (
          <Terminal
            isOpen={terminalOpen}
            onClose={onTerminalClose}
            logs={logs}
            height={terminalHeight}
            onHeightChange={onTerminalHeightChange}
          />
        )}
      </div>

      <BottomBar openFile={openFile} />
    </div>
  );
}
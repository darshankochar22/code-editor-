"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import type { editor } from "monaco-editor";
import { type LogMessage } from "./Terminal";
import type { OpenFile } from "./TabBar";
import Sidebar from "./Sidebar";
import EditorPanel from "./EditorPanel";
import TopBar from "./TopBar";
import ErrorBanner from "./ErrorBanner";
import { useWallet } from "../hooks/useWallet";
import { useFileManager } from "../hooks/useFileManager";

type MonacoType = unknown;

type FileNode = {
  name: string;
  type: "file" | "folder";
  path: string;
  content?: string;
  children?: FileNode[];
};

interface RightProps {
  sidebarVisible?: boolean;
  terminalVisible?: boolean;
  onToggleSidebar?: () => void;
  onToggleTerminal?: () => void;
  onToggleLeftComponent?: () => void;
  leftComponentVisible?: boolean;
}

export default function Right({
  sidebarVisible = true,
  terminalVisible = false,
  onToggleSidebar,
  onToggleTerminal,
  onToggleLeftComponent,
  leftComponentVisible = true,
}: RightProps) {
  const [fontSize, setFontSize] = useState(14);
  const [containerLoading, setContainerLoading] = useState(false);
  const [userId] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(terminalVisible);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const messageCountRef = useRef(0);
  const [terminalHeight, setTerminalHeight] = useState(250);
  const [sidebarWidth, setSidebarWidth] = useState(256); // 256px = w-64
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(256);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wheelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedDeltaRef = useRef(0);

  //const [accountLoading, setAccountLoading] = useState(false);
  //const [contractLoading, setContractLoading] = useState(false);

  // ============================================================================
  // HELPER FUNCTION: Log to Terminal
  // ============================================================================
  const logToTerminal = useCallback(
    (message: string, type: "log" | "error" | "warn" | "info" = "log") => {
      const now = new Date();
      const timestamp = now.toLocaleTimeString();
      setLogs((prev) => [
        ...prev,
        {
          id: messageCountRef.current++,
          message,
          timestamp,
          type,
        },
      ]);
    },
    []
  );

  // Wallet hook
  const { connected, publicKey, connectWallet, disconnectWallet } =
    useWallet(logToTerminal);

  // File Manager hook
  const {
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
    setFiles,
  } = useFileManager(userId, logToTerminal, setError, setTerminalOpen);

  // ============================================================================
  // SIDEBAR RESIZING
  // ============================================================================
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizingSidebar(true);
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingSidebar) return;

      const delta = e.clientX - startXRef.current;
      const newWidth = startWidthRef.current + delta;

      // Constrain width between 200px and 600px
      const constrainedWidth = Math.max(200, Math.min(600, newWidth));
      setSidebarWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
    };

    if (isResizingSidebar) {
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isResizingSidebar, sidebarWidth]);

  // ============================================================================
  // FILE CLICK WRAPPER - Sync with openFiles TabBar state
  // ============================================================================
  const handleFileClickWrapper = useCallback(
    async (file: FileNode) => {
      await handleFileClick(file);
      // Update openFiles for TabBar
      setOpenFiles((prev) => {
        const exists = prev.find((f) => f.path === file.path);
        if (!exists && file.type === "file") {
          return [
            ...prev,
            { path: file.path, name: file.name, isDirty: false },
          ];
        }
        return prev;
      });
    },
    [handleFileClick]
  );

  // ============================================================================
  // TAB BAR HANDLERS
  // ============================================================================
  const handleSelectTab = (path: string) => {
    const file = openFiles.find((f) => f.path === path);
    if (file) {
      // Find the actual FileNode from the file tree
      const findFileNode = (nodes: FileNode[]): FileNode | null => {
        for (const node of nodes) {
          if (node.path === path) return node;
          if (node.children) {
            const found = findFileNode(node.children);
            if (found) return found;
          }
        }
        return null;
      };
      const fileNode = findFileNode(files);
      if (fileNode) {
        setOpenFile(fileNode);
      }
    }
  };

  const handleCloseTab = (path: string) => {
    setOpenFiles((prev) => prev.filter((f) => f.path !== path));
    // If the closed file was active, switch to another file
    if (openFile?.path === path) {
      const remainingFiles = openFiles.filter((f) => f.path !== path);
      if (remainingFiles.length > 0) {
        handleSelectTab(remainingFiles[remainingFiles.length - 1].path);
      } else {
        setOpenFile(null);
      }
    }
  };

  // ============================================================================
  // Update terminal visibility based on prop
  // ============================================================================
  useEffect(() => {
    setTerminalOpen(terminalVisible);
  }, [terminalVisible]);

  // ============================================================================
  // Intercept console methods (KEEP THIS - logs browser console to terminal)
  // ============================================================================
  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    const addLog = (
      message: unknown,
      type: "log" | "error" | "warn" | "info"
    ) => {
      const now = new Date();
      const timestamp = now.toLocaleTimeString();
      const formattedMessage =
        typeof message === "string"
          ? message
          : JSON.stringify(message, null, 2);

      setLogs((prev) => [
        ...prev,
        {
          id: messageCountRef.current++,
          message: formattedMessage,
          timestamp,
          type,
        },
      ]);
    };

    console.log = (...args) => {
      addLog(args.length === 1 ? args[0] : args.join(" "), "log");
      originalLog.apply(console, args);
    };

    console.error = (...args) => {
      addLog(args.length === 1 ? args[0] : args.join(" "), "error");
      originalError.apply(console, args);
    };

    console.warn = (...args) => {
      addLog(args.length === 1 ? args[0] : args.join(" "), "warn");
      originalWarn.apply(console, args);
    };

    console.info = (...args) => {
      addLog(args.length === 1 ? args[0] : args.join(" "), "info");
      originalInfo.apply(console, args);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      console.info = originalInfo;
    };
  }, []);

  // ============================================================================
  // DEPLOY CONTRACT - UPDATED TO LOG VM OUTPUT
  // ============================================================================
  {
    /* 
  const handleDeployContract = async () => {
    if (!publicKey) {
      logToTerminal('✗ Wallet not connected. Please connect your Freighter wallet first.', 'error');
      setError('Wallet not connected');
      return;
    }

    setContractLoading(true);
    setError(null);
    setTerminalOpen(true); // Auto-open terminal
    logToTerminal('Starting contract deployment...', 'info');
    logToTerminal(`Using account: ${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`, 'info');
    
    try {
      const response = await fetch('/api/docker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deployContract', userId, publicKey })
      });
      const data = await response.json();
      
      if (data.success) {
        logToTerminal('✓ Contract deployed successfully!', 'log');
        logToTerminal('=== Deployment Output ===', 'info');
        
        // Log all output from the VM
        const output = data.output || data.stdout || '';
        const errorOutput = data.stderr || '';
        
        if (output) {
          output.split('\n').forEach((line: string) => {
            if (line.trim()) logToTerminal(line, 'log');
          });
        }
        
        if (errorOutput) {
          errorOutput.split('\n').forEach((line: string) => {
            if (line.trim()) logToTerminal(line, 'warn');
          });
        }
      } else {
        logToTerminal('✗ Deployment failed', 'error');
        logToTerminal(`Error: ${data.error}`, 'error');
        
        const errorDetails = data.output || data.stderr || '';
        if (errorDetails) {
          errorDetails.split('\n').forEach((line: string) => {
            if (line.trim()) logToTerminal(line, 'error');
          });
        }
        
        setError(`Failed to deploy contract: ${data.error}`);
      }
    } catch (error) {
      logToTerminal(`✗ Failed to deploy contract: ${error}`, 'error');
      setError('Failed to deploy contract');
    } finally {
      setContractLoading(false);
    }
  }
  */
  }

  // ============================================================================
  // Monaco Editor Setup (KEEP AS IS)
  // ============================================================================
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
              setFontSize(newFontSize);
              editor.updateOptions({ fontSize: newFontSize });
            }
          }

          accumulatedDeltaRef.current = 0;
        }, 50);
      }
    }
  };

  function handleEditorDidMount(
    editorInstance: editor.IStandaloneCodeEditor,
    monaco: MonacoType
  ) {
    editorRef.current = editorInstance;
    editorInstance.focus();

    if (monaco && monaco.languages) {
      monaco.languages.typescript?.typescriptDefaults?.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        moduleResolution:
          monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        noEmit: true,
        esModuleInterop: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
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

    return () => {
      if (containerRef.current) {
        containerRef.current.removeEventListener("wheel", handleMouseWheel);
      }
      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current);
      }
    };
  }

  function handleEditorChange(value: string | undefined) {
    if (openFile && value !== undefined) {
      const newContents = new Map(fileContents);
      newContents.set(openFile.path, value);
      setFileContents(newContents);
      // Mark file as dirty in the tab bar
      setOpenFiles((prev) =>
        prev.map((f) =>
          f.path === openFile.path ? { ...f, isDirty: true } : f
        )
      );
    }
  }

  // ============================================================================
  // CREATE CONTAINER - UPDATED TO LOG TO TERMINAL
  // ============================================================================
  async function handleCreateContainer() {
    setContainerLoading(true);
    setError(null);
    setTerminalOpen(true); // Auto-open terminal
    logToTerminal("Creating Docker container...", "info");

    try {
      const response = await fetch("/api/docker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", userId }),
      });

      const data = await response.json();

      if (data.success) {
        logToTerminal(`✓ ${data.message}`, "log");

        // Log any setup output
        if (data.output) {
          data.output.split("\n").forEach((line: string) => {
            if (line.trim()) logToTerminal(line, "log");
          });
        }

        await loadFiles();
      } else {
        logToTerminal(`✗ Failed to create container: ${data.error}`, "error");
        setError(`Failed to create container: ${data.error}`);
      }
    } catch (error) {
      logToTerminal(`✗ Failed to create container: ${error}`, "error");
      setError("Failed to create container");
    } finally {
      setContainerLoading(false);
    }
  }

  // ============================================================================
  // DELETE CONTAINER - UPDATED TO LOG TO TERMINAL
  // ============================================================================
  async function handleDeleteContainer() {
    if (!confirm(`Delete container for user ${userId}?`)) {
      return;
    }

    setContainerLoading(true);
    setError(null);
    setTerminalOpen(true); // Auto-open terminal
    logToTerminal("Deleting Docker container...", "info");

    try {
      const response = await fetch("/api/docker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", userId }),
      });

      const data = await response.json();

      if (data.success) {
        logToTerminal(`✓ ${data.message}`, "log");
        setFiles([]);
        setOpenFile(null);
        setFileContents(new Map());
      } else {
        logToTerminal(`✗ Failed to delete container: ${data.error}`, "error");
        setError(`Failed to delete container: ${data.error}`);
      }
    } catch (error) {
      logToTerminal(`✗ Failed to delete container: ${error}`, "error");
      setError("Failed to delete container");
    } finally {
      setContainerLoading(false);
    }
  }

  // ============================================================================
  // CREATE ACCOUNT - UPDATED TO LOG TO TERMINAL
  // ============================================================================
  {
    /*
  async function handleCreateAccount() {
    setAccountLoading(true);
    setError(null);
    setTerminalOpen(true); // Auto-open terminal
    logToTerminal('Creating Stellar account...', 'info');

    try {
      const response = await fetch('/api/docker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createAccount', userId })
      });
      const data = await response.json();
      if (data.success) {
        logToTerminal('✓ Account created successfully!', 'log');
        
        // Log stdout from VM
        if (data.stdout) {
          data.stdout.split('\n').forEach((line: string) => {
            if (line.trim()) logToTerminal(line, 'log');
          });
        }
        
        // Log stderr from VM as warnings
        if (data.stderr) {
          data.stderr.split('\n').forEach((line: string) => {
            if (line.trim()) logToTerminal(line, 'warn');
          });
        }
        
        // Log backup message
        if (data.message) {
          logToTerminal(`✓ ${data.message}`, 'log');
        }
        logToTerminal('✓ Credentials backed up to soroban-hello-world/.config', 'log');
      } else {
        logToTerminal(`✗ Failed to create account: ${data.error}`, 'error');
        setError(`Failed to create account: ${data.error}`);
      }
    } catch (error) {
      logToTerminal(`✗ Failed to create account: ${error}`, 'error');
      setError('Failed to create account');
    } finally {
      setAccountLoading(false);
    }
  }
*/
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }

      // Zoom In: CMD/CTRL + = or CMD/CTRL + SHIFT + I
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === "+" || e.key === "=" || (e.shiftKey && e.key === "i"))
      ) {
        e.preventDefault();
        const newFontSize = Math.min(fontSize + 2, 40);
        setFontSize(newFontSize);
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
        setFontSize(newFontSize);
        if (editorRef.current) {
          editorRef.current.updateOptions({ fontSize: newFontSize });
        }
      }

      // Reset Zoom: CMD/CTRL + 0
      if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault();
        setFontSize(14);
        if (editorRef.current) {
          editorRef.current.updateOptions({ fontSize: 14 });
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fontSize, openFile, fileContents, handleSave]);

  return (
    <div className="flex flex-col h-full bg-[#171717] overflow-hidden">
      <TopBar
        userId={userId}
        connected={connected}
        publicKey={publicKey}
        isSaving={isSaving}
        containerLoading={containerLoading}
        openFile={openFile}
        sidebarVisible={sidebarVisible}
        terminalVisible={terminalVisible}
        leftComponentVisible={leftComponentVisible}
        onConnectWallet={connectWallet}
        onDisconnectWallet={disconnectWallet}
        onSave={handleSave}
        onCreateContainer={handleCreateContainer}
        onDeleteContainer={handleDeleteContainer}
        onToggleSidebar={() => onToggleSidebar?.()}
        onToggleTerminal={() => onToggleTerminal?.()}
        onToggleLeftComponent={() => onToggleLeftComponent?.()}
        onLog={logToTerminal}
      />

      <ErrorBanner error={error} />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarVisible && (
          <Sidebar
            sidebarWidth={sidebarWidth}
            onMouseDown={handleMouseDown}
            files={files}
            isLoading={isLoading}
            expandedFolders={expandedFolders}
            openFile={openFile}
            creatingItem={creatingItem}
            newItemName={newItemName}
            onToggleFolder={toggleFolder}
            onFileClick={handleFileClickWrapper}
            onCreateFile={handleCreateFile}
            onCreateFolder={handleCreateFolder}
            onDeleteFile={handleDeleteFile}
            onDeleteFolder={handleDeleteFolder}
            onSetNewItemName={setNewItemName}
            onConfirmCreateItem={confirmCreateItem}
            onCancelCreateItem={cancelCreateItem}
            onCreateFileRoot={() => handleCreateFile("")}
            onCreateFolderRoot={() => handleCreateFolder("")}
          />
        )}

        {/* Editor */}
        <EditorPanel
          openFile={openFile}
          openFiles={openFiles}
          fileContents={fileContents}
          fontSize={fontSize}
          terminalOpen={terminalOpen}
          terminalHeight={terminalHeight}
          logs={logs}
          onFileSelect={handleSelectTab}
          onFileClose={handleCloseTab}
          onEditorChange={handleEditorChange}
          onEditorMount={handleEditorDidMount}
          onSave={handleSave}
          onTerminalClose={() => setTerminalOpen(false)}
          onTerminalHeightChange={setTerminalHeight}
        />
      </div>
    </div>
  );
}

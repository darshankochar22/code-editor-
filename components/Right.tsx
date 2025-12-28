"use client";

import { useRef, useState, useEffect } from "react";
import type { editor } from "monaco-editor";
import { isConnected, setAllowed, getAddress } from "@stellar/freighter-api";
import { type LogMessage } from "./Terminal";
import { DeployButton } from "./DeployButton";
import type { OpenFile } from "./TabBar";
import Sidebar from "./Sidebar";
import EditorPanel from "./EditorPanel";

type MonacoType = unknown;

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
  const [files, setFiles] = useState<FileNode[]>([]);
  const [openFile, setOpenFile] = useState<FileNode | null>(null);
  const [fileContents, setFileContents] = useState<Map<string, string>>(
    new Map()
  );
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(["src"])
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [containerLoading, setContainerLoading] = useState(false);
  const [userId] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [creatingItem, setCreatingItem] = useState<CreationState>(null);
  const [newItemName, setNewItemName] = useState("");
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wheelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedDeltaRef = useRef(0);
  const [connected, setConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  //const [accountLoading, setAccountLoading] = useState(false);
  //const [contractLoading, setContractLoading] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(terminalVisible);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const messageCountRef = useRef(0);
  const [terminalHeight, setTerminalHeight] = useState(250);
  const [sidebarWidth, setSidebarWidth] = useState(256); // 256px = w-64
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(256);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);

  // ============================================================================
  // HELPER FUNCTION: Log to Terminal
  // ============================================================================
  const logToTerminal = (
    message: string,
    type: "log" | "error" | "warn" | "info" = "log"
  ) => {
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
  };

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
  // Freighter Wallet Functions
  // ============================================================================
  const isFreighterAvailable = () => {
    if (typeof window === "undefined") return false;
    return (
      (window as unknown as Record<string, unknown>).freighter !== undefined
    );
  };

  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window === "undefined") return;

      try {
        if (!isFreighterAvailable()) {
          console.log("Freighter not installed");
          return;
        }

        const alreadyConnected = await isConnected();
        if (alreadyConnected) {
          const result = await getAddress();
          setConnected(true);
          setPublicKey(result.address || null);
          console.log("Already connected to wallet:", result.address);
        }
      } catch (err) {
        console.log("Not connected to wallet:", err);
      }
    };

    checkConnection();
  }, []);

  // ============================================================================
  // CONNECT WALLET - UPDATED TO LOG TO TERMINAL
  // ============================================================================
  const connectWallet = async () => {
    try {
      setError(null);
      logToTerminal("Connecting to Freighter wallet...", "info");

      if (typeof window === "undefined") return;

      const connectionStatus = await isConnected();
      if (!connectionStatus.isConnected) {
        logToTerminal("✗ Freighter wallet not found", "error");
        setError(
          "Freighter wallet not found. Please install it from freighter.app"
        );
        window.open("https://www.freighter.app/", "_blank");
        return;
      }

      const access = await setAllowed();

      if (access.isAllowed) {
        const { address, error } = await getAddress();

        if (address) {
          setPublicKey(address);
          setConnected(true);
          logToTerminal(
            `✓ Wallet connected: ${address.slice(0, 4)}...${address.slice(-4)}`,
            "log"
          );
        } else {
          throw new Error(error || "Failed to retrieve address");
        }
      } else {
        logToTerminal("✗ User declined wallet access", "warn");
        throw new Error("User declined access");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logToTerminal(`✗ Connection error: ${errorMessage}`, "error");
      setError(errorMessage || "Failed to connect wallet.");
      setConnected(false);
    }
  };

  const disconnectWallet = () => {
    setConnected(false);
    setPublicKey(null);
    setError(null);
    logToTerminal("✓ Wallet disconnected", "log");
  };

  // ============================================================================
  // LOAD FILES
  // ============================================================================
  async function loadFiles(preserveExpanded = true) {
    setIsLoading(true);
    setError(null);
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
        setError(data.error || "Failed to load files");
        setFiles([]);
      }
    } catch (error) {
      console.error("Failed to load files:", error);
      setError("Failed to connect to server");
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const initializeFiles = async () => {
      await loadFiles(false);
    };
    initializeFiles();
  }, [userId]);

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
      setFileContents((prev) => new Map(prev).set(openFile.path, value));
      // Mark file as dirty in the tab bar
      setOpenFiles((prev) =>
        prev.map((f) =>
          f.path === openFile.path ? { ...f, isDirty: true } : f
        )
      );
    }
  }

  async function handleFileClick(file: FileNode) {
    if (file.type === "file") {
      if (fileContents.has(file.path)) {
        setOpenFile(file);
        // Add to open files if not already there
        setOpenFiles((prev) => {
          const exists = prev.find((f) => f.path === file.path);
          if (!exists) {
            return [
              ...prev,
              { path: file.path, name: file.name, isDirty: false },
            ];
          }
          return prev;
        });
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
          setFileContents((prev) => new Map(prev).set(file.path, data.content));
          setOpenFile(file);
          // Add to open files
          setOpenFiles((prev) => {
            const exists = prev.find((f) => f.path === file.path);
            if (!exists) {
              return [
                ...prev,
                { path: file.path, name: file.name, isDirty: false },
              ];
            }
            return prev;
          });
          setError(null);
        } else {
          setError(`Failed to load ${file.name}: ${data.error}`);
        }
      } catch (error) {
        console.error("Failed to load file:", error);
        setError(`Failed to load ${file.name}`);
      }
    }
  }

  // ============================================================================
  // SAVE FILE - UPDATED TO LOG TO TERMINAL
  // ============================================================================
  async function handleSave() {
    if (!openFile) return;
    setIsSaving(true);
    setError(null);
    logToTerminal(`Saving ${openFile.name}...`, "info");

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
        logToTerminal(`✓ ${openFile.name} saved successfully`, "log");
        // Mark file as clean
        setOpenFiles((prev) =>
          prev.map((f) =>
            f.path === openFile.path ? { ...f, isDirty: false } : f
          )
        );
        setTimeout(() => setError(null), 2000);
      } else {
        logToTerminal(
          `✗ Failed to save ${openFile.name}: ${data.error}`,
          "error"
        );
        setError(`Failed to save: ${data.error}`);
      }
    } catch (error) {
      logToTerminal(`✗ Failed to save ${openFile.name}: ${error}`, "error");
      setError("Failed to save file");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateFile(parentPath: string = "") {
    setCreatingItem({ parentPath, type: "file" });
    setNewItemName("");
  }

  async function handleCreateFolder(parentPath: string = "") {
    setCreatingItem({ parentPath, type: "folder" });
    setNewItemName("");
  }

  // ============================================================================
  // CREATE FILE/FOLDER - UPDATED TO LOG TO TERMINAL
  // ============================================================================
  async function confirmCreateItem() {
    if (!creatingItem || !newItemName.trim()) {
      setCreatingItem(null);
      return;
    }

    const fileName = newItemName.trim();
    const fullPath = creatingItem.parentPath
      ? `${creatingItem.parentPath}/${fileName}`
      : fileName;

    setTerminalOpen(true); // Auto-open terminal
    logToTerminal(`Creating ${creatingItem.type}: ${fullPath}`, "info");

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
        logToTerminal(`✓ ${creatingItem.type} created: ${fullPath}`, "log");
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
        logToTerminal(
          `✗ Failed to create ${creatingItem.type}: ${data.error}`,
          "error"
        );
        setError(`Failed to create ${creatingItem.type}: ${data.error}`);
        setCreatingItem(null);
      }
    } catch (error) {
      logToTerminal(
        `✗ Failed to create ${creatingItem.type}: ${error}`,
        "error"
      );
      setError(`Failed to create ${creatingItem.type}`);
      setCreatingItem(null);
    }
  }

  function cancelCreateItem() {
    setCreatingItem(null);
    setNewItemName("");
  }

  // ============================================================================
  // DELETE FILE - UPDATED TO LOG TO TERMINAL
  // ============================================================================
  async function handleDeleteFile(filePath: string) {
    if (!confirm(`Delete file: ${filePath}?`)) {
      return;
    }

    setTerminalOpen(true); // Auto-open terminal
    logToTerminal(`Deleting ${filePath}...`, "info");

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
        logToTerminal(`✓ File deleted: ${filePath}`, "log");
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
        logToTerminal(`✗ Failed to delete file: ${data.error}`, "error");
        setError(`Failed to delete file: ${data.error}`);
      }
    } catch (error) {
      logToTerminal(`✗ Failed to delete file: ${error}`, "error");
      setError("Failed to delete file");
    }
  }

  // ============================================================================
  // DELETE FOLDER - UPDATED TO LOG TO TERMINAL
  // ============================================================================
  async function handleDeleteFolder(folderPath: string) {
    if (!confirm(`Delete folder and all contents: ${folderPath}?`)) {
      return;
    }

    setTerminalOpen(true); // Auto-open terminal
    logToTerminal(`Deleting folder ${folderPath}...`, "info");

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
        logToTerminal(`✓ Folder deleted: ${folderPath}`, "log");
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
        logToTerminal(`✗ Failed to delete folder: ${data.error}`, "error");
        setError(`Failed to delete folder: ${data.error}`);
      }
    } catch (error) {
      logToTerminal(`✗ Failed to delete folder: ${error}`, "error");
      setError("Failed to delete folder");
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
  function toggleFolder(path: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

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
      {/* Top bar */}
      <div className="h-10 bg-[#171717] border-b border-[#252525] flex items-center justify-between px-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">User: {userId}</span>

          {connected ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white">
                {publicKey?.slice(0, 4)}...{publicKey?.slice(-4)}
              </span>
              <button
                onClick={disconnectWallet}
                className="text-xs px-3 py-1 rounded dark:bg-black hover:bg-[#171717] text-white transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={connectWallet}
              className="text-xs px-3 py-1 rounded dark:bg-black hover:bg-[#171717] text-white transition-colors"
            >
              Connect Wallet
            </button>
          )}

          {openFile && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="text-xs px-3 py-1 rounded dark:bg-black hover:bg-[#171717] disabled:bg-gray-600 text-white disabled:opacity-50 transition-colors"
            >
              {isSaving ? "Saving..." : "Save (⌘S)"}
            </button>
          )}
          <button
            onClick={handleCreateContainer}
            disabled={containerLoading}
            className="text-xs px-3 py-1 rounded dark:bg-black hover:bg-[#171717] disabled:bg-gray-600 text-white disabled:opacity-50 transition-colors"
          >
            {containerLoading ? "Loading..." : "Create Container"}
          </button>
          <button
            onClick={handleDeleteContainer}
            disabled={containerLoading}
            className="text-xs px-3 py-1 rounded dark:bg-black hover:bg-[#171717] disabled:bg-gray-600 text-white disabled:opacity-50 transition-colors"
          >
            {containerLoading ? "Loading..." : "Delete Container"}
          </button>
          {/*     <button
            onClick={() => loadFiles(true)}
            disabled={isLoading}
            className="text-xs px-3 py-1 rounded dark:bg-black hover:bg-[#171717] disabled:bg-gray-800 text-white disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
          <button
            onClick={handleCreateAccount}
            disabled={accountLoading}
            className="text-xs px-3 py-1 rounded dark:bg-black hover:bg-[#171717] disabled:bg-gray-800 text-white disabled:opacity-50 transition-colors"
          >
            {accountLoading ? 'Loading....' : 'Create Account'}
          </button>
          <button
            onClick={handleDeployContract}
            disabled={contractLoading}
            className="text-xs px-3 py-1 rounded dark:bg-black hover:bg-[#171717] disabled:bg-gray-800 text-white disabled:opacity-50 transition-colors"
          >
            {contractLoading ? 'Loading....' : 'Deploy Contract'}
          </button> */}
          <DeployButton
            userId={userId}
            onLog={logToTerminal}
            isConnected={connected}
            onConnectWallet={connectWallet}
          />
        </div>

        {/* Spacer */}
        <div className="flex-1"></div>

        {/* Toggle Icons */}
        <div className="flex items-center gap-2">
          {/* Icon 1: Toggle Sidebar */}
          <div
            className={`w-6 h-6 flex items-center justify-center cursor-pointer rounded transition-colors ${
              sidebarVisible
                ? "hover:bg-[#252525] hover:text-[#cccccc] text-[#cccccc]"
                : "hover:bg-[#252525] hover:text-[#cccccc] text-[#888888]"
            }`}
            onClick={() => onToggleSidebar?.()}
            title={sidebarVisible ? "Hide Sidebar" : "Show Sidebar"}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-4 h-4"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </div>

          {/* Icon 2: Toggle Console/Terminal */}
          <div
            className={`w-6 h-6 flex items-center justify-center cursor-pointer rounded transition-colors ${
              terminalVisible
                ? "hover:bg-[#252525] hover:text-[#cccccc] text-[#cccccc]"
                : "hover:bg-[#252525] hover:text-[#cccccc] text-[#888888]"
            }`}
            onClick={() => onToggleTerminal?.()}
            title={terminalVisible ? "Hide Terminal" : "Show Terminal"}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-4 h-4"
            >
              <polyline points="4 17 10 11 4 5"></polyline>
              <line x1="12" y1="19" x2="20" y2="19"></line>
            </svg>
          </div>

          {/* Icon 3: Toggle Left Component (Full Width Right) */}
          <div
            className={`w-6 h-6 flex items-center justify-center cursor-pointer rounded transition-colors ${
              !leftComponentVisible
                ? "hover:bg-[#252525] hover:text-[#cccccc] text-[#cccccc]"
                : "hover:bg-[#252525] hover:text-[#cccccc] text-[#888888]"
            }`}
            onClick={() => onToggleLeftComponent?.()}
            title={leftComponentVisible ? "Hide Left Panel" : "Show Left Panel"}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-4 h-4"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="15" y1="3" x2="15" y2="21" />
            </svg>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="dark:bg-black  px-4 py-2">
          <p className="text-white text-sm">{error}</p>
        </div>
      )}

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
            onFileClick={handleFileClick}
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

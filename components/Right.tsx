'use client';

import { useRef, useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { FilePlus, FolderPlus, X, Trash2, Terminal as TerminalIcon } from 'lucide-react';
import { isConnected, setAllowed, getAddress } from "@stellar/freighter-api";
import Terminal, { type LogMessage } from './Terminal';
import { DeployButton } from './DeployButton';

type MonacoType = any;

type FileNode = {
  name: string;
  type: 'file' | 'folder';
  path: string;
  content?: string;
  children?: FileNode[];
};

type CreationState = {
  parentPath: string;
  type: 'file' | 'folder';
} | null;

export default function Right() {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [openFile, setOpenFile] = useState<FileNode | null>(null);
  const [fileContents, setFileContents] = useState<Map<string, string>>(new Map());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src']));
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [containerLoading, setContainerLoading] = useState(false);
  const [userId] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [creatingItem, setCreatingItem] = useState<CreationState>(null);
  const [newItemName, setNewItemName] = useState('');
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wheelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedDeltaRef = useRef(0);
  const [connected, setConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [contractLoading, setContractLoading] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const messageCountRef = useRef(0);
  const [terminalHeight, setTerminalHeight] = useState(250);

  // ============================================================================
  // HELPER FUNCTION: Log to Terminal
  // ============================================================================
  const logToTerminal = (message: string, type: 'log' | 'error' | 'warn' | 'info' = 'log') => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString();
    setLogs(prev => [...prev, {
      id: messageCountRef.current++,
      message,
      timestamp,
      type
    }]);
  };

  // ============================================================================
  // Intercept console methods (KEEP THIS - logs browser console to terminal)
  // ============================================================================
  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    const addLog = (message: any, type: 'log' | 'error' | 'warn' | 'info') => {
      const now = new Date();
      const timestamp = now.toLocaleTimeString();
      const formattedMessage = 
        typeof message === 'string' 
          ? message 
          : JSON.stringify(message, null, 2);

      setLogs(prev => [...prev, {
        id: messageCountRef.current++,
        message: formattedMessage,
        timestamp,
        type
      }]);
    };

    console.log = (...args) => {
      addLog(args.length === 1 ? args[0] : args.join(' '), 'log');
      originalLog.apply(console, args);
    };

    console.error = (...args) => {
      addLog(args.length === 1 ? args[0] : args.join(' '), 'error');
      originalError.apply(console, args);
    };

    console.warn = (...args) => {
      addLog(args.length === 1 ? args[0] : args.join(' '), 'warn');
      originalWarn.apply(console, args);
    };

    console.info = (...args) => {
      addLog(args.length === 1 ? args[0] : args.join(' '), 'info');
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

  // ============================================================================
  // Freighter Wallet Functions
  // ============================================================================
  const isFreighterAvailable = () => {
    if (typeof window === 'undefined') return false;
    return window.freighter !== undefined;
  };

  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window === 'undefined') return;
      
      try {
        if (!isFreighterAvailable()) {
          console.log('Freighter not installed');
          return;
        }

        const alreadyConnected = await isConnected();
        if (alreadyConnected) {
          const key = await getAddress();
          setConnected(true);
          setPublicKey(key);
          console.log('Already connected to wallet:', key);
        }
      } catch (err) {
        console.log('Not connected to wallet:', err);
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
      logToTerminal('Connecting to Freighter wallet...', 'info');
      
      if (typeof window === 'undefined') return;
  
      const connectionStatus = await isConnected();
      if (!connectionStatus.isConnected) {
        logToTerminal('✗ Freighter wallet not found', 'error');
        setError('Freighter wallet not found. Please install it from freighter.app');
        window.open('https://www.freighter.app/', '_blank');
        return;
      }
      
      const access = await setAllowed();
      
      if (access.isAllowed) {
        const { address, error } = await getAddress();
        
        if (address) {
          setPublicKey(address);
          setConnected(true);
          logToTerminal(`✓ Wallet connected: ${address.slice(0, 4)}...${address.slice(-4)}`, 'log');
        } else {
          throw new Error(error || 'Failed to retrieve address');
        }
      } else {
        logToTerminal('✗ User declined wallet access', 'warn');
        throw new Error('User declined access');
      }
    } catch (err: any) {
      logToTerminal(`✗ Connection error: ${err.message}`, 'error');
      setError(err.message || 'Failed to connect wallet.');
      setConnected(false);
    }
  };
  
  const disconnectWallet = () => {
    setConnected(false);
    setPublicKey(null);
    setError(null);
    logToTerminal('✓ Wallet disconnected', 'log');
  };

  // ============================================================================
  // LOAD FILES
  // ============================================================================
  async function loadFiles(preserveExpanded = true) {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/docker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getFiles', userId })
      });
        const data = await response.json();
      
      if (data.success && data.files) {
        const tree = buildFileTree(data.files);
        setFiles(tree);
        
        if (!preserveExpanded) {
          const commonFolders = ['src', 'contracts', 'soroban-hello-world'];
          setExpandedFolders(new Set(commonFolders));
        }
      } else {
        setError(data.error || 'Failed to load files');
        setFiles([]);
      }
      } catch (error) {
        console.error('Failed to load files:', error);
      setError('Failed to connect to server');
      setFiles([]);
      } finally {
        setIsLoading(false);
      }
    }

  useEffect(() => {
    loadFiles(false);
  }, [userId]);

  // ============================================================================
  // Monaco Editor Setup (KEEP AS IS)
  // ============================================================================
  useEffect(() => {
    const styleId = 'monaco-custom-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
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

          const currentFontSize = (editor.getOption(55) as unknown as number) || 14;
          const normalizedDelta = accumulatedDeltaRef.current / 100;
          const zoomDelta = Math.round(normalizedDelta);

          if (zoomDelta !== 0) {
            const newFontSize = Math.max(8, Math.min(40, currentFontSize - zoomDelta));
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

  function handleEditorDidMount(editorInstance: editor.IStandaloneCodeEditor, monaco: MonacoType) {
    editorRef.current = editorInstance;
    editorInstance.focus();

    if (monaco && monaco.languages) {
      monaco.languages.typescript?.typescriptDefaults?.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
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
      containerRef.current.addEventListener('wheel', handleMouseWheel, { passive: false });
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.removeEventListener('wheel', handleMouseWheel);
      }
      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current);
      }
    };
  }

  function handleEditorChange(value: string | undefined) {
    if (openFile && value !== undefined) {
      setFileContents(prev => new Map(prev).set(openFile.path, value));
    }
  }

  async function handleFileClick(file: FileNode) {
    if (file.type === 'file') {
      if (fileContents.has(file.path)) {
        setOpenFile(file);
        return;
      }

      try {
        const response = await fetch('/api/docker', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getFileContent', userId, filePath: file.path })
        });
        const data = await response.json();
        
        if (data.success) {
        setFileContents(prev => new Map(prev).set(file.path, data.content));
        setOpenFile(file);
          setError(null);
        } else {
          setError(`Failed to load ${file.name}: ${data.error}`);
        }
      } catch (error) {
        console.error('Failed to load file:', error);
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
    logToTerminal(`Saving ${openFile.name}...`, 'info');
    
    try {
      const content = fileContents.get(openFile.path) || '';
      const response = await fetch('/api/docker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveFileContent', 
          userId, 
          filePath: openFile.path, 
          content
        })
      });

      const data = await response.json();
      
      if (data.success) {
        logToTerminal(`✓ ${openFile.name} saved successfully`, 'log');
        setTimeout(() => setError(null), 2000);
      } else {
        logToTerminal(`✗ Failed to save ${openFile.name}: ${data.error}`, 'error');
        setError(`Failed to save: ${data.error}`);
      }
    } catch (error) {
      logToTerminal(`✗ Failed to save ${openFile.name}: ${error}`, 'error');
      setError('Failed to save file');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateFile(parentPath: string = '') {
    setCreatingItem({ parentPath, type: 'file' });
    setNewItemName('');
  }

  async function handleCreateFolder(parentPath: string = '') {
    setCreatingItem({ parentPath, type: 'folder' });
    setNewItemName('');
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
    logToTerminal(`Creating ${creatingItem.type}: ${fullPath}`, 'info');

    try {
      const response = await fetch('/api/docker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: creatingItem.type === 'file' ? 'createFile' : 'createFolder',
          userId, 
          filePath: fullPath
        })
      });

      const data = await response.json();
      
      if (data.success) {
        logToTerminal(`✓ ${creatingItem.type} created: ${fullPath}`, 'log');
        await loadFiles();
        
        if (creatingItem.type === 'file') {
          const newFile: FileNode = {
            name: fileName,
            type: 'file',
            path: fullPath
          };
          setFileContents(prev => new Map(prev).set(fullPath, ''));
          setOpenFile(newFile);
        } else {
          setExpandedFolders(prev => new Set(prev).add(fullPath));
        }
        
        setCreatingItem(null);
        setNewItemName('');
      } else {
        logToTerminal(`✗ Failed to create ${creatingItem.type}: ${data.error}`, 'error');
        setError(`Failed to create ${creatingItem.type}: ${data.error}`);
        setCreatingItem(null);
      }
    } catch (error) {
      logToTerminal(`✗ Failed to create ${creatingItem.type}: ${error}`, 'error');
      setError(`Failed to create ${creatingItem.type}`);
      setCreatingItem(null);
    }
  }

  function cancelCreateItem() {
    setCreatingItem(null);
    setNewItemName('');
  }

  // ============================================================================
  // DELETE FILE - UPDATED TO LOG TO TERMINAL
  // ============================================================================
  async function handleDeleteFile(filePath: string) {
    if (!confirm(`Delete file: ${filePath}?`)) {
      return;
    }

    setTerminalOpen(true); // Auto-open terminal
    logToTerminal(`Deleting ${filePath}...`, 'info');

    try {
      const response = await fetch('/api/docker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'deleteFile',
          userId, 
          filePath
        })
      });

      const data = await response.json();
      
      if (data.success) {
        logToTerminal(`✓ File deleted: ${filePath}`, 'log');
        if (openFile?.path === filePath) {
          setOpenFile(null);
        }
        setFileContents(prev => {
          const newContents = new Map(prev);
          newContents.delete(filePath);
          return newContents;
        });
        await loadFiles();
      } else {
        logToTerminal(`✗ Failed to delete file: ${data.error}`, 'error');
        setError(`Failed to delete file: ${data.error}`);
      }
    } catch (error) {
      logToTerminal(`✗ Failed to delete file: ${error}`, 'error');
      setError('Failed to delete file');
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
    logToTerminal(`Deleting folder ${folderPath}...`, 'info');

    try {
      const response = await fetch('/api/docker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'deleteFolder',
          userId, 
          filePath: folderPath
        })
      });

      const data = await response.json();
      
      if (data.success) {
        logToTerminal(`✓ Folder deleted: ${folderPath}`, 'log');
        if (openFile?.path.startsWith(folderPath)) {
          setOpenFile(null);
        }
        setExpandedFolders(prev => {
          const newExpanded = new Set(prev);
          newExpanded.delete(folderPath);
          return newExpanded;
        });
        await loadFiles();
      } else {
        logToTerminal(`✗ Failed to delete folder: ${data.error}`, 'error');
        setError(`Failed to delete folder: ${data.error}`);
      }
    } catch (error) {
      logToTerminal(`✗ Failed to delete folder: ${error}`, 'error');
      setError('Failed to delete folder');
    }
  }

  // ============================================================================
  // CREATE CONTAINER - UPDATED TO LOG TO TERMINAL
  // ============================================================================
  async function handleCreateContainer() {
    setContainerLoading(true);
    setError(null);
    setTerminalOpen(true); // Auto-open terminal
    logToTerminal('Creating Docker container...', 'info');
    
    try {
      const response = await fetch('/api/docker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', userId })
      });
      
      const data = await response.json();
      
      if (data.success) {
        logToTerminal(`✓ ${data.message}`, 'log');
        
        // Log any setup output
        if (data.output) {
          data.output.split('\n').forEach((line: string) => {
            if (line.trim()) logToTerminal(line, 'log');
          });
        }
        
        await loadFiles();
      } else {
        logToTerminal(`✗ Failed to create container: ${data.error}`, 'error');
        setError(`Failed to create container: ${data.error}`);
      }
    } catch (error) {
      logToTerminal(`✗ Failed to create container: ${error}`, 'error');
      setError('Failed to create container');
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
    logToTerminal('Deleting Docker container...', 'info');
    
    try {
      const response = await fetch('/api/docker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', userId })
      });
      
      const data = await response.json();
      
      if (data.success) {
        logToTerminal(`✓ ${data.message}`, 'log');
        setFiles([]);
        setOpenFile(null);
        setFileContents(new Map());
      } else {
        logToTerminal(`✗ Failed to delete container: ${data.error}`, 'error');
        setError(`Failed to delete container: ${data.error}`);
      }
    } catch (error) {
      logToTerminal(`✗ Failed to delete container: ${error}`, 'error');
      setError('Failed to delete container');
    } finally {
      setContainerLoading(false);
    }
  }

  // ============================================================================
  // CREATE ACCOUNT - UPDATED TO LOG TO TERMINAL
  // ============================================================================
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

  function toggleFolder(path: string) {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  function getFileContent(file: FileNode): string {
    return fileContents.get(file.path) ?? '';
  }

  function buildFileTree(flatFiles: string[]): FileNode[] {
    type TreeNode = FileNode & { _children?: { [key: string]: TreeNode } };
    const root: { [key: string]: TreeNode } = {};
    
    flatFiles.forEach(filePath => {
      const parts = filePath.split('/').filter(p => p.length > 0);
      let currentLevel = root;
      
      parts.forEach((part, index) => {
        if (!currentLevel[part]) {
          const isFile = index === parts.length - 1;
          const fullPath = parts.slice(0, index + 1).join('/');
          
          currentLevel[part] = {
            name: part,
            type: isFile ? 'file' : 'folder',
            path: fullPath,
            children: isFile ? undefined : [],
            _children: isFile ? undefined : {}
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
          return a.type === 'folder' ? -1 : 1;
        })
        .map(node => {
          const result: FileNode = {
            name: node.name,
            type: node.type,
            path: node.path
          };
          
          if (node.type === 'folder' && node._children) {
            result.children = convertToArray(node._children);
          }
          
          return result;
        });
    }
    
    return convertToArray(root);
  }

  function getLanguage(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const languageMap: { [key: string]: string } = {
      'rs': 'rust',
      'toml': 'toml',
      'json': 'json',
      'md': 'markdown',
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'yaml': 'yaml',
      'yml': 'yaml',
      'sh': 'shell',
      'py': 'python',
    };
    return languageMap[ext || ''] || 'plaintext';
  }

  function renderFileTree(nodes: FileNode[], depth = 0, parentPath = '') {
    return (
      <>
        {nodes.map(node => (
      <div key={node.path}>
        <div
              className={`flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-[#252525] group ${
            openFile?.path === node.path ? 'bg-[#252525]' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (node.type === 'folder') {
              toggleFolder(node.path);
            } else {
              handleFileClick(node);
            }
          }}
        >
          {node.type === 'folder' && (
            <span className="text-gray-400 text-xs">
              {expandedFolders.has(node.path) ? '▼' : '▶'}
            </span>
          )}
              <span className="text-gray-300 text-sm flex-1">{node.name}</span>
              
              <div className="hidden group-hover:flex items-center gap-1">
                {node.type === 'folder' && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateFile(node.path);
                      }}
                      className="p-1 hover:bg-[#333] rounded transition-colors"
                      title="New File"
                    >
                      <FilePlus className="w-3 h-3 text-gray-400" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateFolder(node.path);
                      }}
                      className="p-1 hover:bg-[#333] rounded transition-colors"
                      title="New Folder"
                    >
                      <FolderPlus className="w-3 h-3 text-gray-400" />
                    </button>
                  </>
                )}
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (node.type === 'file') {
                      handleDeleteFile(node.path);
                    } else {
                      handleDeleteFolder(node.path);
                    }
                  }}
                  className="p-1 hover:bg-[#ff4444] rounded transition-colors"
                  title={`Delete ${node.type}`}
                >
                  <Trash2 className="w-3 h-3 text-gray-400 hover:text-red-400" />
                </button>
              </div>
            </div>
            
            {node.type === 'folder' && 
             creatingItem && 
             creatingItem.parentPath === node.path && 
             expandedFolders.has(node.path) && (
              <div 
                className="flex items-center gap-2 px-2 py-1 bg-[#1e1e1e]"
                style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
              >
                <span className="text-gray-400 text-xs">
                  {creatingItem.type === 'file' ? '📄' : '📁'}
                </span>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      confirmCreateItem();
                    } else if (e.key === 'Escape') {
                      cancelCreateItem();
                    }
                  }}
                  onBlur={confirmCreateItem}
                  autoFocus
                  placeholder={creatingItem.type === 'file' ? 'filename.rs' : 'foldername'}
                  className="flex-1 bg-[#252525] text-white text-sm px-2 py-0.5 rounded outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={cancelCreateItem}
                  className="p-1 hover:bg-[#333] rounded transition-colors"
                >
                  <X className="w-3 h-3 text-gray-400" />
                </button>
        </div>
            )}
            
        {node.type === 'folder' && expandedFolders.has(node.path) && node.children && (
              <div>{renderFileTree(node.children, depth + 1, node.path)}</div>
            )}
          </div>
        ))}
        
        {depth === 0 && creatingItem && creatingItem.parentPath === parentPath && (
          <div 
            className="flex items-center gap-2 px-2 py-1 bg-[#1e1e1e]"
            style={{ paddingLeft: '8px' }}
          >
            <span className="text-gray-400 text-xs">
              {creatingItem.type === 'file' ? '📄' : '📁'}
            </span>
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  confirmCreateItem();
                } else if (e.key === 'Escape') {
                  cancelCreateItem();
                }
              }}
              onBlur={confirmCreateItem}
              autoFocus
              placeholder={creatingItem.type === 'file' ? 'filename.rs' : 'foldername'}
              className="flex-1 bg-[#252525] text-white text-sm px-2 py-0.5 rounded outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={cancelCreateItem}
              className="p-1 hover:bg-[#333] rounded transition-colors"
            >
              <X className="w-3 h-3 text-gray-400" />
            </button>
          </div>
        )}
      </>
    );
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        const newFontSize = Math.min(fontSize + 2, 40);
        setFontSize(newFontSize);
        if (editorRef.current) {
          editorRef.current.updateOptions({ fontSize: newFontSize });
        }
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        const newFontSize = Math.max(fontSize - 2, 8);
        setFontSize(newFontSize);
        if (editorRef.current) {
          editorRef.current.updateOptions({ fontSize: newFontSize });
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        setFontSize(14);
        if (editorRef.current) {
          editorRef.current.updateOptions({ fontSize: 14 });
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fontSize, openFile, fileContents]);

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
            {isSaving ? 'Saving...' : 'Save (⌘S)'}
          </button>
        )}
          <button
            onClick={handleCreateContainer}
            disabled={containerLoading}
            className="text-xs px-3 py-1 rounded dark:bg-black hover:bg-[#171717] disabled:bg-gray-600 text-white disabled:opacity-50 transition-colors"
          >
            {containerLoading ? 'Loading...' : 'Create Container'}
          </button>
          <button
            onClick={handleDeleteContainer}
            disabled={containerLoading}
            className="text-xs px-3 py-1 rounded dark:bg-black hover:bg-[#171717] disabled:bg-gray-600 text-white disabled:opacity-50 transition-colors"
          >
            {containerLoading ? 'Loading...' : 'Delete Container'}
      { /*    </button>
          <button
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
          <DeployButton userId={userId} onLog={logToTerminal} isConnected={connected} onConnectWallet={connectWallet} />
          <button
            onClick={() => setTerminalOpen(!terminalOpen)}
            className="text-xs px-3 py-1 rounded dark:bg-black hover:bg-[#171717] text-white transition-colors flex items-center gap-2"
            title="Toggle Console"
          >
            <TerminalIcon className="w-3 h-3" />
            Console
          </button>
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <span>Zoom: {fontSize}px</span>
          <span className="text-gray-600">| ⌘/Ctrl+Scroll</span>
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
        <div className="w-64 bg-[#171717] border-r border-[#252525] overflow-y-auto flex flex-col">
          {/* Sidebar Header with Create Buttons */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#252525]">
            <span className="text-xs text-gray-400 font-semibold uppercase">Explorer</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleCreateFile('')}
                className="p-1 hover:bg-[#252525] rounded transition-colors"
                title="New File"
                disabled={files.length === 0}
              >
                <FilePlus className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => handleCreateFolder('')}
                className="p-1 hover:bg-[#252525] rounded transition-colors"
                title="New Folder"
                disabled={files.length === 0}
              >
                <FolderPlus className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
          
          <div className="py-2 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-2 text-gray-500 text-sm">Loading files...</div>
            ) : files.length === 0 ? (
              <div className="px-4 py-2 text-gray-500 text-sm">
                No files. Create a container first.
              </div>
            ) : (
              renderFileTree(files)
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 bg-[#171717] flex flex-col" ref={containerRef}>
          {/* Editor Area with Terminal */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-hidden">
          {openFile ? (
            <Editor
              height="100%"
              language={getLanguage(openFile.name)}
              theme="vs-dark"
              value={getFileContent(openFile)}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              options={{
                    fontSize: fontSize,
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'Monaco', monospace",
                minimap: { enabled: true },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
                formatOnPaste: true,
                formatOnType: true,
                    insertSpaces: true,
                    suggestOnTriggerCharacters: true,
                    acceptSuggestionOnEnter: 'on',
                    quickSuggestions: true,
                    parameterHints: { enabled: true },
                    folding: true,
                    renderWhitespace: 'selection',
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on',
                    smoothScrolling: true,
                    padding: { top: 16 },
                    scrollbar: {
                      vertical: 'visible',
                      horizontal: 'visible',
                      useShadows: true,
                      verticalSliderSize: 12,
                      horizontalSliderSize: 12,
                    },
                    renderLineHighlight: 'gutter',
                    overviewRulerBorder: false,
                    hideCursorInOverviewRuler: false,
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <div className="text-6xl mb-4">📁</div>
                    <p className="text-lg mb-2">No file selected</p>
                    <p className="text-sm">Open a file from the sidebar to start editing</p>
                  </div>
                </div>
              )}
            </div>

            {/* Terminal */}
            {terminalOpen && (
              <Terminal 
                isOpen={terminalOpen} 
                onClose={() => setTerminalOpen(false)} 
                logs={logs}
                height={terminalHeight}
                onHeightChange={setTerminalHeight}
              />
            )}
          </div>

          {/* Bottom bar - Always at the very bottom */}
          <div className="h-8 bg-[#171717] border-t border-[#252525] flex items-center justify-between px-3 flex-shrink-0">
            <div className="text-xs text-gray-500 flex items-center gap-2">
              {openFile ? (
                <>
                  <span>{openFile.name}</span>
                  <span className="text-gray-600">|</span>
                  <span>UTF-8</span>
                </>
              ) : (
                <span>No file selected</span>
              )}
            </div>
            <div className="text-xs text-gray-500">
              {openFile ? `Ln 1, Col 1` : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
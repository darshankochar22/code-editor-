'use client';

import { useRef, useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

type MonacoType = any;

type FileNode = {
  name: string;
  type: 'file' | 'folder';
  path: string;
  content?: string;
  children?: FileNode[];
};

export default function Right() {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [openFile, setOpenFile] = useState<FileNode | null>(null);
  const [fileContents, setFileContents] = useState<Map<string, string>>(new Map());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src']));
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [containerLoading, setContainerLoading] = useState(false);
  const [userId, setUserId] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wheelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedDeltaRef = useRef(0);

  // Load file tree from Docker container
  async function loadFiles() {
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
        
        // Auto-expand common folders
        const commonFolders = ['src', 'contracts'];
        setExpandedFolders(new Set(commonFolders));
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

  // Load files on mount and when userId changes
  useEffect(() => {
    loadFiles();
  }, [userId]);

  // Remove Monaco blue borders
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

    // Configure language support
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

    // Add mouse wheel zoom
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
      // Check if already loaded
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

  async function handleSave() {
    if (!openFile) return;

    setIsSaving(true);
    setError(null);
    
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
        console.log('File saved successfully');
        // Show brief success indicator
        setTimeout(() => setError(null), 2000);
      } else {
        setError(`Failed to save: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      setError('Failed to save file');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateContainer() {
    setContainerLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/docker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', userId })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('Container created:', data.message);
        // Reload files after container creation
        await loadFiles();
      } else {
        setError(`Failed to create container: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to create container:', error);
      setError('Failed to create container');
    } finally {
      setContainerLoading(false);
    }
  }

  async function handleDeleteContainer() {
    if (!confirm(`Delete container for user ${userId}?`)) {
      return;
    }

    setContainerLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/docker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', userId })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('Container deleted:', data.message);
        // Clear state
        setFiles([]);
        setOpenFile(null);
        setFileContents(new Map());
      } else {
        setError(`Failed to delete container: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to delete container:', error);
      setError('Failed to delete container');
    } finally {
      setContainerLoading(false);
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
    const root: { [key: string]: FileNode } = {};
    
    flatFiles.forEach(filePath => {
      const parts = filePath.split('/').filter(p => p.length > 0);
      let currentLevel: any = root;
      
      parts.forEach((part, index) => {
        if (!currentLevel[part]) {
          const isFile = index === parts.length - 1;
          const fullPath = parts.slice(0, index + 1).join('/');
          
          currentLevel[part] = {
            name: part,
            type: isFile ? 'file' : 'folder',
            path: fullPath,
            children: isFile ? undefined : []
          };
        }
        
        if (currentLevel[part].children !== undefined && index < parts.length - 1) {
          const childrenMap: any = {};
          currentLevel[part].children!.forEach((node: FileNode) => {
            childrenMap[node.name] = node;
          });
          currentLevel = childrenMap;
        }
      });
    });
    
    // Convert to sorted array
    function sortNodes(nodes: FileNode[]): FileNode[] {
      return nodes.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'folder' ? -1 : 1;
      }).map(node => {
        if (node.children) {
          node.children = sortNodes(node.children);
        }
        return node;
      });
    }
    
    return sortNodes(Object.values(root));
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

  function renderFileTree(nodes: FileNode[], depth = 0) {
    return nodes.map(node => (
      <div key={node.path}>
        <div
          className={`flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-[#252525] ${
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
          <span className="text-gray-300 text-sm">{node.name}</span>
        </div>
        {node.type === 'folder' && expandedFolders.has(node.path) && node.children && (
          <div>{renderFileTree(node.children, depth + 1)}</div>
        )}
      </div>
    ));
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
    <div className="flex flex-col h-screen bg-[#171717]">
      {/* Top bar */}
      <div className="h-10 bg-[#171717] border-b border-[#252525] flex items-center justify-between px-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">User: {userId}</span>
          {openFile && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="text-xs px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white disabled:opacity-50 transition-colors"
            >
              {isSaving ? 'Saving...' : '💾 Save (⌘S)'}
            </button>
          )}
          <button
            onClick={handleCreateContainer}
            disabled={containerLoading}
            className="text-xs px-3 py-1 rounded bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white disabled:opacity-50 transition-colors"
          >
            {containerLoading ? '⏳' : '+ Container'}
          </button>
          <button
            onClick={handleDeleteContainer}
            disabled={containerLoading}
            className="text-xs px-3 py-1 rounded bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white disabled:opacity-50 transition-colors"
          >
            {containerLoading ? '⏳' : '🗑️ Delete'}
          </button>
          <button
            onClick={loadFiles}
            disabled={isLoading}
            className="text-xs px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white disabled:opacity-50 transition-colors"
          >
            {isLoading ? '⏳' : '🔄 Refresh'}
          </button>
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <span>Zoom: {fontSize}px</span>
          <span className="text-gray-600">| ⌘/Ctrl+Scroll</span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-900/50 border-b border-red-800 px-4 py-2">
          <p className="text-red-200 text-sm">⚠️ {error}</p>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-[#171717] border-r border-[#252525] overflow-y-auto flex flex-col">
          <div className="py-2">
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

          {/* Bottom bar */}
          <div className="h-8 bg-[#171717] border-t border-[#252525] flex items-center justify-between px-3">
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
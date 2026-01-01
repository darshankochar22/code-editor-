"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { type LogMessage } from "./Terminal";
import Sidebar from "./Sidebar";
import EditorPanel from "./EditorPanel";
import TopBar from "./TopBar";
import ErrorBanner from "./ErrorBanner";
import { useWallet } from "../hooks/useWallet";
import { useFileManager } from "../hooks/useFileManager";
import { useMonacoSetup } from "../hooks/useMonacoSetup";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useContainerManagement } from "../hooks/useContainerManagement";
import { useTerminalLogging } from "../hooks/useTerminalLogging";
import { useSidebarResize } from "../hooks/useSidebarResize";
import { useTabManagement } from "../hooks/useTabManagement";
import { useEditorState } from "../hooks/useEditorState";

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
  projectName?: string;
}

export default function Right({
  sidebarVisible = true,
  terminalVisible = false,
  onToggleSidebar,
  onToggleTerminal,
  onToggleLeftComponent,
  leftComponentVisible = false,
  projectName,
}: RightProps) {
  const [fontSize, setFontSize] = useState(14);
  const [containerLoading, setContainerLoading] = useState(false);
  const [userId] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(terminalVisible);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [terminalHeight, setTerminalHeight] = useState(250);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { logToTerminal } = useTerminalLogging({
    onLogsUpdate: (newLogs) => {
      setLogs((prev) => [...prev, ...newLogs]);
    },
  });

  const { sidebarWidth, handleMouseDown } = useSidebarResize({
    initialWidth: 256,
    minWidth: 200,
    maxWidth: 600,
  });

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
  } = useFileManager(
    userId,
    logToTerminal,
    setError,
    setTerminalOpen,
    projectName
  );

  // Monaco Editor Setup hook
  const { editorRef, handleEditorDidMount } = useMonacoSetup({
    onFontSizeChange: setFontSize,
    containerRef,
  });

  // Keyboard Shortcuts hook
  useKeyboardShortcuts({
    onSave: handleSave,
    fontSize,
    onFontSizeChange: setFontSize,
    editorRef,
  });

  // Tab Management hook
  const { openFiles, addOpenFile, handleSelectTab, handleCloseTab } =
    useTabManagement({
      files,
      onFileSelect: setOpenFile,
      onOpenFilesChange: () => {}, // Will be updated inline
    });

  // Editor State hook
  const { handleEditorChange } = useEditorState({
    openFile,
    fileContents,
    onFileContentsChange: setFileContents,
    onOpenFilesChange: () => {
      // This will be handled by tab management
    },
  });

  // Container Management hook
  const { handleCreateContainer, handleDeleteContainer } =
    useContainerManagement({
      userId,
      logToTerminal,
      onContainerLoading: setContainerLoading,
      onError: setError,
      onTerminalOpen: setTerminalOpen,
      onLoadFiles: loadFiles,
      onClearFiles: () => {
        setFiles([]);
        setOpenFile(null);
        setFileContents(new Map());
      },
    });

  // Store callbacks in refs to avoid dependency chains
  const handleFileClickRef = useRef(handleFileClick);
  const addOpenFileRef = useRef(addOpenFile);

  useEffect(() => {
    handleFileClickRef.current = handleFileClick;
    addOpenFileRef.current = addOpenFile;
  }, [handleFileClick, addOpenFile]);

  // FILE CLICK WRAPPER - Sync with openFiles TabBar state
  // Memoized without dependencies to prevent callback redefinition
  const handleFileClickWrapper = useMemo(
    () => async (file: FileNode) => {
      await handleFileClickRef.current(file);
      addOpenFileRef.current(file);
    },
    []
  );

  // Memoize root file/folder creation handlers to prevent Sidebar re-renders
  // Use refs to avoid dependencies
  const handleCreateFileRef = useRef(handleCreateFile);
  const handleCreateFolderRef = useRef(handleCreateFolder);

  useEffect(() => {
    handleCreateFileRef.current = handleCreateFile;
    handleCreateFolderRef.current = handleCreateFolder;
  }, [handleCreateFile, handleCreateFolder]);

  const handleCreateFileRoot = useMemo(
    () => () => handleCreateFileRef.current(""),
    []
  );

  const handleCreateFolderRoot = useMemo(
    () => () => handleCreateFolderRef.current(""),
    []
  );

  useEffect(() => {
    setTerminalOpen(terminalVisible);
  }, [terminalVisible]);

  // Deploy Contract: hooks/archived/useContractDeployment.ts
  // Create Account: hooks/archived/useAccountCreation.ts

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
        projectName={projectName}
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
            onCreateFileRoot={handleCreateFileRoot}
            onCreateFolderRoot={handleCreateFolderRoot}
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

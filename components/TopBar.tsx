"use client";

import { DeployButton } from "./DeployButton";
import ToggleButtons from "./ToggleButtons";

interface TopBarProps {
  userId: string;
  connected: boolean;
  publicKey: string | null;
  isSaving: boolean;
  containerLoading: boolean;
  openFile: { name: string } | null;
  sidebarVisible: boolean;
  terminalVisible: boolean;
  leftComponentVisible: boolean;
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
  onSave: () => void | Promise<void>;
  onCreateContainer: () => void | Promise<void>;
  onDeleteContainer: () => void | Promise<void>;
  onToggleSidebar: () => void;
  onToggleTerminal: () => void;
  onToggleLeftComponent: () => void;
  onLog: (message: string, type: "log" | "error" | "warn" | "info") => void;
}

export default function TopBar({
  userId,
  connected,
  publicKey,
  isSaving,
  containerLoading,
  openFile,
  sidebarVisible,
  terminalVisible,
  leftComponentVisible,
  onConnectWallet,
  onDisconnectWallet,
  onSave,
  onCreateContainer,
  onDeleteContainer,
  onToggleSidebar,
  onToggleTerminal,
  onToggleLeftComponent,
  onLog,
}: TopBarProps) {
  return (
    <div className="h-10 bg-[#171717] border-b border-[#252525] flex items-center justify-between px-3">
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500">User: {userId}</span>

        {connected ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-white">
              {publicKey?.slice(0, 4)}...{publicKey?.slice(-4)}
            </span>
            <button
              onClick={onDisconnectWallet}
              className="text-xs px-3 py-1 rounded dark:bg-black hover:bg-[#171717] text-white transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={onConnectWallet}
            className="text-xs px-3 py-1 rounded dark:bg-black hover:bg-[#171717] text-white transition-colors"
          >
            Connect Wallet
          </button>
        )}

        {openFile && (
          <button
            onClick={onSave}
            disabled={isSaving}
            className="text-xs px-3 py-1 rounded dark:bg-black hover:bg-[#171717] disabled:bg-gray-600 text-white disabled:opacity-50 transition-colors"
          >
            {isSaving ? "Saving..." : "Save (⌘S)"}
          </button>
        )}

        <button
          onClick={onCreateContainer}
          disabled={containerLoading}
          className="text-xs px-3 py-1 rounded dark:bg-black hover:bg-[#171717] disabled:bg-gray-600 text-white disabled:opacity-50 transition-colors"
        >
          {containerLoading ? "Loading..." : "Create Container"}
        </button>

        <button
          onClick={onDeleteContainer}
          disabled={containerLoading}
          className="text-xs px-3 py-1 rounded dark:bg-black hover:bg-[#171717] disabled:bg-gray-600 text-white disabled:opacity-50 transition-colors"
        >
          {containerLoading ? "Loading..." : "Delete Container"}
        </button>

        <DeployButton
          userId={userId}
          onLog={onLog}
          isConnected={connected}
          onConnectWallet={onConnectWallet}
        />
      </div>

      {/* Spacer */}
      <div className="flex-1"></div>

      {/* Toggle Buttons */}
      <ToggleButtons
        sidebarVisible={sidebarVisible}
        terminalVisible={terminalVisible}
        leftComponentVisible={leftComponentVisible}
        onToggleSidebar={onToggleSidebar}
        onToggleTerminal={onToggleTerminal}
        onToggleLeftComponent={onToggleLeftComponent}
      />
    </div>
  );
}

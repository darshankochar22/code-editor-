"use client";

interface ToggleButtonsProps {
  sidebarVisible: boolean;
  terminalVisible: boolean;
  leftComponentVisible: boolean;
  onToggleSidebar: () => void;
  onToggleTerminal: () => void;
  onToggleLeftComponent: () => void;
}

export default function ToggleButtons({
  sidebarVisible,
  terminalVisible,
  leftComponentVisible,
  onToggleSidebar,
  onToggleTerminal,
  onToggleLeftComponent,
}: ToggleButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Icon 1: Toggle Sidebar */}
      <div
        className={`w-6 h-6 flex items-center justify-center cursor-pointer rounded transition-colors ${
          sidebarVisible
            ? "hover:bg-[#252525] hover:text-[#cccccc] text-[#cccccc]"
            : "hover:bg-[#252525] hover:text-[#cccccc] text-[#888888]"
        }`}
        onClick={onToggleSidebar}
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
        onClick={onToggleTerminal}
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
        onClick={onToggleLeftComponent}
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
  );
}

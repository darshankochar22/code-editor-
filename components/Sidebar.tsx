"use client";

import { FilePlus, FolderPlus, X, Trash2 } from "lucide-react";

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

interface SidebarProps {
  sidebarWidth: number;
  onMouseDown: (e: React.MouseEvent) => void;
  files: FileNode[];
  isLoading: boolean;
  expandedFolders: Set<string>;
  openFile: FileNode | null;
  creatingItem: CreationState;
  newItemName: string;
  onToggleFolder: (path: string) => void;
  onFileClick: (file: FileNode) => void;
  onCreateFile: (parentPath: string) => void;
  onCreateFolder: (parentPath: string) => void;
  onDeleteFile: (filePath: string) => void;
  onDeleteFolder: (folderPath: string) => void;
  onSetNewItemName: (name: string) => void;
  onConfirmCreateItem: () => void;
  onCancelCreateItem: () => void;
  onCreateFileRoot: () => void;
  onCreateFolderRoot: () => void;
}

export default function Sidebar({
  sidebarWidth,
  onMouseDown,
  files,
  isLoading,
  expandedFolders,
  openFile,
  creatingItem,
  newItemName,
  onToggleFolder,
  onFileClick,
  onCreateFile,
  onCreateFolder,
  onDeleteFile,
  onDeleteFolder,
  onSetNewItemName,
  onConfirmCreateItem,
  onCancelCreateItem,
  onCreateFileRoot,
  onCreateFolderRoot,
}: SidebarProps) {
  function renderFileTree(nodes: FileNode[], depth = 0, parentPath = "") {
    return (
      <>
        {nodes.map((node) => (
          <div key={node.path}>
            <div
              className={`flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-[#252525] group ${
                openFile?.path === node.path ? "bg-[#252525]" : ""
              }`}
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
              onClick={() => {
                if (node.type === "folder") {
                  onToggleFolder(node.path);
                } else {
                  onFileClick(node);
                }
              }}
            >
              {node.type === "folder" && (
                <span className="text-gray-400 text-xs">
                  {expandedFolders.has(node.path) ? "▼" : "▶"}
                </span>
              )}
              <span className="text-gray-300 text-sm flex-1">{node.name}</span>

              <div className="hidden group-hover:flex items-center gap-1">
                {node.type === "folder" && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateFile(node.path);
                      }}
                      className="p-1 hover:bg-[#333] rounded transition-colors"
                      title="New File"
                    >
                      <FilePlus className="w-3 h-3 text-gray-400" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateFolder(node.path);
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
                    if (node.type === "file") {
                      onDeleteFile(node.path);
                    } else {
                      onDeleteFolder(node.path);
                    }
                  }}
                  className="p-1 hover:bg-[#ff4444] rounded transition-colors"
                  title={`Delete ${node.type}`}
                >
                  <Trash2 className="w-3 h-3 text-gray-400 hover:text-red-400" />
                </button>
              </div>
            </div>

            {node.type === "folder" &&
              creatingItem &&
              creatingItem.parentPath === node.path &&
              expandedFolders.has(node.path) && (
                <div
                  className="flex items-center gap-2 px-2 py-1 bg-[#1e1e1e]"
                  style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
                >
                  <span className="text-gray-400 text-xs">
                    {creatingItem.type === "file" ? "📄" : "📁"}
                  </span>
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => onSetNewItemName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        onConfirmCreateItem();
                      } else if (e.key === "Escape") {
                        onCancelCreateItem();
                      }
                    }}
                    onBlur={onConfirmCreateItem}
                    autoFocus
                    placeholder={
                      creatingItem.type === "file"
                        ? "filename.rs"
                        : "foldername"
                    }
                    className="flex-1 bg-[#252525] text-white text-sm px-2 py-0.5 rounded outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={onCancelCreateItem}
                    className="p-1 hover:bg-[#333] rounded transition-colors"
                  >
                    <X className="w-3 h-3 text-gray-400" />
                  </button>
                </div>
              )}

            {node.type === "folder" &&
              expandedFolders.has(node.path) &&
              node.children && (
                <div>{renderFileTree(node.children, depth + 1, node.path)}</div>
              )}
          </div>
        ))}

        {depth === 0 &&
          creatingItem &&
          creatingItem.parentPath === parentPath && (
            <div
              className="flex items-center gap-2 px-2 py-1 bg-[#1e1e1e]"
              style={{ paddingLeft: "8px" }}
            >
              <span className="text-gray-400 text-xs">
                {creatingItem.type === "file" ? "📄" : "📁"}
              </span>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => onSetNewItemName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onConfirmCreateItem();
                  } else if (e.key === "Escape") {
                    onCancelCreateItem();
                  }
                }}
                onBlur={onConfirmCreateItem}
                autoFocus
                placeholder={
                  creatingItem.type === "file" ? "filename.rs" : "foldername"
                }
                className="flex-1 bg-[#252525] text-white text-sm px-2 py-0.5 rounded outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={onCancelCreateItem}
                className="p-1 hover:bg-[#333] rounded transition-colors"
              >
                <X className="w-3 h-3 text-gray-400" />
              </button>
            </div>
          )}
      </>
    );
  }

  return (
    <>
      <div
        style={{ width: `${sidebarWidth}px` }}
        className="bg-[#171717] border-r border-[#252525] overflow-y-auto flex flex-col sidebar-scrollbar transition-none"
      >
        {/* Sidebar Header with Create Buttons */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#252525]">
          <span className="text-xs text-gray-400 font-semibold uppercase">
            Explorer
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={onCreateFileRoot}
              className="p-1 hover:bg-[#252525] rounded transition-colors"
              title="New File"
              disabled={files.length === 0}
            >
              <FilePlus className="w-4 h-4 text-gray-400" />
            </button>
            <button
              onClick={onCreateFolderRoot}
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
            <div className="px-4 py-2 text-gray-500 text-sm">
              Loading files...
            </div>
          ) : files.length === 0 ? (
            <div className="px-4 py-2 text-gray-500 text-sm">
              No files. Create a container first.
            </div>
          ) : (
            renderFileTree(files)
          )}
        </div>
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={onMouseDown}
        className="w-1 bg-[#252525] hover:bg-[#3a3a3a] cursor-col-resize transition-colors shrink-0"
        title="Drag to resize sidebar"
      />
    </>
  );
}

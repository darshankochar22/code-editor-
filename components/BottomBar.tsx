"use client";

type FileNode = {
  name: string;
  type: "file" | "folder";
  path: string;
  content?: string;
  children?: FileNode[];
};

interface BottomBarProps {
  openFile: FileNode | null;
}

export default function BottomBar({ openFile }: BottomBarProps) {
  return (
    <div className="h-8 bg-[#171717] border-t border-[#252525] flex items-center justify-between px-3 shrink-0">
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
        {openFile ? `Ln 1, Col 1` : ""}
      </div>
    </div>
  );
}

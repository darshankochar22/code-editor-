"use client";
import { useState } from "react";
import LeftComponent from "@/components/Left";
import RightComponent from "@/components/Right";

interface EditorComponentProps {
  projectName?: string;
}

const EditorComponent = ({ projectName }: EditorComponentProps) => {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [leftComponentVisible, setLeftComponentVisible] = useState(false);
  const [terminalVisible, setTerminalVisible] = useState(false);

  const handleToggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  const handleToggleTerminal = () => {
    setTerminalVisible(!terminalVisible);
  };

  const handleToggleLeftComponent = () => {
    setLeftComponentVisible(!leftComponentVisible);
  };

  return (
    <div className="flex w-full h-screen bg-black dark:bg-black overflow-hidden">
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Side */}
        {leftComponentVisible && (
          <div className="w-[33%] dark:bg-black overflow-hidden flex flex-col">
            <LeftComponent />
          </div>
        )}

        {/* Right Side */}
        <div
          className={`${
            leftComponentVisible ? "w-[67%]" : "w-full"
          } bg-[#171717] overflow-hidden flex flex-col transition-all duration-300`}
        >
          <RightComponent
            sidebarVisible={sidebarVisible}
            terminalVisible={terminalVisible}
            onToggleSidebar={handleToggleSidebar}
            onToggleTerminal={handleToggleTerminal}
            onToggleLeftComponent={handleToggleLeftComponent}
            leftComponentVisible={leftComponentVisible}
            projectName={projectName}
          />
        </div>
      </div>
    </div>
  );
};

export default EditorComponent;

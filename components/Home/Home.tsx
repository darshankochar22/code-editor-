"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/context/WalletContext";
import { useProjectManagement } from "@/hooks/useProjectManagement";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { HeroSection } from "./HeroSection";
import { RecentProjects } from "./RecentProjects";

export function Home() {
  const wallet = useWallet();
  const {
    projects,
    isLoading,
    isCreating,
    loadProjects,
    createProject,
    deleteProject,
  } = useProjectManagement();

  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [walletVisible, setWalletVisible] = useState(true);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [promptValue, setPromptValue] = useState("");

  useEffect(() => {
    if (wallet.walletAddress) {
      loadProjects();
    }
  }, [wallet.walletAddress]);

  const handleCreateProject = async () => {
    const success = await createProject(newProjectName, newProjectDesc);
    if (success) {
      setNewProjectName("");
      setNewProjectDesc("");
      setShowCreateForm(false);
    }
  };

  const handleDeleteProject = async (projectName: string) => {
    await deleteProject(projectName);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCreateProject();
    }
  };

  return (
    <div className="w-full h-screen bg-black flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-size-[64px_64px]"></div>

      <TopBar
        walletVisible={walletVisible}
        onToggleWallet={() => setWalletVisible(!walletVisible)}
        isConnected={wallet.isConnected}
        walletAddress={wallet.walletAddress}
        walletBalance={wallet.walletBalance}
        onConnect={(address, balance) => {
          wallet.connect(address, balance);
        }}
        onDisconnect={() => {
          wallet.disconnect();
        }}
      />

      <div className="flex flex-1 overflow-hidden relative z-10 w-full">
        <Sidebar
          visible={sidebarVisible}
          onToggle={() => setSidebarVisible(!sidebarVisible)}
          projects={projects}
          isLoading={isLoading}
          isCreating={isCreating}
          showCreateForm={showCreateForm}
          onToggleCreateForm={() => setShowCreateForm(!showCreateForm)}
          newProjectName={newProjectName}
          onProjectNameChange={setNewProjectName}
          newProjectDesc={newProjectDesc}
          onProjectDescChange={setNewProjectDesc}
          onCreateProject={handleCreateProject}
          onDeleteProject={handleDeleteProject}
          onKeyPress={handleKeyPress}
        />

        <div className="flex-1 flex flex-col items-center justify-center px-8 py-8 w-full">
          <div className="w-full max-w-3xl">
            <HeroSection
              promptValue={promptValue}
              onPromptChange={setPromptValue}
            />
            <RecentProjects projects={projects} />
          </div>
        </div>
      </div>
    </div>
  );
}

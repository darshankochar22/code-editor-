"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@/context/WalletContext";
import type { Project } from "@/components/Home/types";

export function useProjectManagement() {
  const wallet = useWallet();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const loadProjects = useCallback(async () => {
    if (!wallet.walletAddress) {
      setProjects([]);
      return;
    }
    
    setIsLoading(true);
    try {
      const containerHealthResponse = await fetch("/api/docker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkHealth",
          walletAddress: wallet.walletAddress,
        }),
      });
      const healthData = await containerHealthResponse.json();
      if (!healthData.isHealthy) {
        console.warn("Container not healthy, attempting to recreate...");
        await fetch("/api/docker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            walletAddress: wallet.walletAddress,
          }),
        });
        wallet.setContainerReady(true);
      }

      const response = await fetch("/api/docker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "getAllProjects",
          walletAddress: wallet.walletAddress,
        }),
      });
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error("Error loading projects:", error);
    } finally {
      setIsLoading(false);
    }
  }, [wallet.walletAddress, wallet]);

  const createProject = async (name: string, description: string) => {
    if (!name.trim()) return false;
    if (!wallet.walletAddress) {
      alert("Please connect your wallet first");
      return false;
    }

    try {
      setIsCreating(true);
      const response = await fetch("/api/docker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createProject",
          walletAddress: wallet.walletAddress,
          projectName: name,
          description: description,
        }),
      });
      const data = await response.json();
      if (data.success) {
        await loadProjects();
        return true;
      } else {
        alert(`Error: ${data.error}`);
        return false;
      }
    } catch (error) {
      console.error("Error creating project:", error);
      alert("Failed to create project");
      return false;
    } finally {
      setIsCreating(false);
    }
  };

  const deleteProject = async (projectName: string) => {
    if (!confirm(`Delete project "${projectName}"?`)) return false;
    if (!wallet.walletAddress) {
      alert("Please connect your wallet first");
      return false;
    }

    try {
      const response = await fetch("/api/docker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deleteProject",
          walletAddress: wallet.walletAddress,
          projectName,
        }),
      });
      const data = await response.json();
      if (data.success) {
        await loadProjects();
        return true;
      } else {
        alert(`Error: ${data.error}`);
        return false;
      }
    } catch (error) {
      console.error("Error deleting project:", error);
      return false;
    }
  };

  return {
    projects,
    isLoading,
    isCreating,
    loadProjects,
    createProject,
    deleteProject,
  };
}


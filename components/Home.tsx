"use client";
import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Plus, Trash2, FolderOpen, Loader, Send } from "lucide-react";

interface Project {
  id: string;
  name: string;
  createdAt: string;
  description?: string;
  contractType: "soroban";
}

const HomeComponent = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [userId] = useState("1");
  const [promptValue, setPromptValue] = useState("");

  const loadProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/docker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getAllProjects", userId }),
      });
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error("Error loading projects:", error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    try {
      setIsCreating(true);
      const response = await fetch("/api/docker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createProject",
          userId,
          projectName: newProjectName,
          description: newProjectDesc,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setNewProjectName("");
        setNewProjectDesc("");
        setShowCreateForm(false);
        await loadProjects();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Error creating project:", error);
      alert("Failed to create project");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async (projectName: string) => {
    if (!confirm(`Delete project "${projectName}"?`)) return;

    try {
      const response = await fetch("/api/docker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deleteProject",
          userId,
          projectName,
        }),
      });
      const data = await response.json();
      if (data.success) {
        await loadProjects();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Error deleting project:", error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreateProject();
    }
  };

  return (
    <div className="w-full h-screen bg-black flex flex-col relative overflow-hidden">
      {/* Subtle grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:64px_64px]"></div>

      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Sidebar */}
        <div className="w-80 border-r border-white/5 bg-[#0a0a0a] overflow-y-auto">
          {/* Projects Section */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3 mt-2">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Projects</h2>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="p-1.5 hover:bg-white/5 rounded-lg transition-all duration-200 group"
                title="New Project"
              >
                <Plus size={16} className="text-gray-500 group-hover:text-white transition-colors" />
              </button>
            </div>

            {/* Create Project Form */}
            {showCreateForm && (
              <div className="mb-4 p-4 bg-white/[0.02] rounded-xl border border-white/5">
                <input
                  type="text"
                  placeholder="Project name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-full px-3 py-2 bg-black/60 text-white border border-white/10 rounded-lg mb-2 placeholder-gray-600 focus:outline-none focus:border-white/20 transition-all"
                  disabled={isCreating}
                  autoFocus
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-full px-3 py-2 bg-black/60 text-white border border-white/10 rounded-lg mb-3 placeholder-gray-600 focus:outline-none focus:border-white/20 transition-all"
                  disabled={isCreating}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateProject}
                    disabled={isCreating || !newProjectName.trim()}
                    className="flex-1 px-3 py-2 bg-white text-black hover:bg-gray-200 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                  >
                    {isCreating ? (
                      <Loader size={16} className="animate-spin" />
                    ) : (
                      <Plus size={16} />
                    )}
                    Create
                  </button>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Projects List */}
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loader size={24} className="text-gray-600 animate-spin" />
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.02] flex items-center justify-center">
                  <FolderOpen size={32} className="opacity-40 text-gray-600" />
                </div>
                <p className="font-medium">No projects yet</p>
                <p className="text-sm mt-1 text-gray-600">Create one to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/editor?project=${encodeURIComponent(project.name)}`}
                  >
                    <div className="p-3 bg-white/[0.02] hover:bg-white/[0.04] rounded-xl border border-white/5 hover:border-white/10 transition-all duration-200 cursor-pointer group">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0 flex items-start gap-3">
                          <div className="p-2 bg-white/5 rounded-lg group-hover:bg-white/10 transition-all">
                            <FolderOpen size={16} className="text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-white truncate text-sm">
                              {project.name}
                            </h3>
                            {project.description && (
                              <p className="text-xs text-gray-500 truncate mt-0.5">
                                {project.description}
                              </p>
                            )}
                            <p className="text-xs text-gray-600 mt-1.5">
                              {new Date(project.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteProject(project.name);
                          }}
                          className="ml-2 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 text-gray-500 rounded-lg transition-all duration-200"
                          title="Delete project"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-8">
          <div className="w-full max-w-3xl">
            {/* Welcome Section */}
            <div className="text-center mb-12">
              <h2 className="text-5xl font-bold text-white mb-4">
                Build Smart Contracts
              </h2>
              <p className="text-gray-500 text-lg">
                Start creating, testing, and deploying your Soroban smart contracts
              </p>
            </div>

            {/* Prompt Bar (Non-functional) */}
            <div className="mb-8">
              <div className="relative group">
                <div className="absolute inset-0 bg-white/[0.02] rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
                <div className="relative bg-white/[0.02] border border-white/10 rounded-2xl p-1.5">
                  <div className="flex items-end gap-3 p-3">
                    <textarea
                      value={promptValue}
                      onChange={(e) => setPromptValue(e.target.value)}
                      placeholder="Ask me anything about your smart contracts... (Coming soon)"
                      className="flex-1 bg-transparent text-white placeholder-gray-600 resize-none focus:outline-none min-h-[56px] max-h-[200px] py-3 px-2"
                      rows={1}
                    />
                    <button
                      className="p-3 bg-white hover:bg-gray-200 text-black rounded-xl transition-all duration-200 opacity-50 cursor-not-allowed"
                    >
                      <Send size={20} />
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-600 text-center mt-3">
                AI assistant coming soon • Get help with code, debugging, and deployment
              </p>
            </div>

            {/* Quick Start Cards */}
            {projects.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-1 h-6 bg-white rounded-full"></span>
                  Recent Projects
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {projects.slice(0, 3).map((project) => (
                    <Link
                      key={project.id}
                      href={`/editor?project=${encodeURIComponent(project.name)}`}
                    >
                      <div className="p-4 bg-white/[0.02] hover:bg-white/[0.04] rounded-xl border border-white/5 hover:border-white/10 transition-all duration-200 cursor-pointer group">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-white/5 rounded-xl group-hover:bg-white/10 transition-all">
                            <FolderOpen size={24} className="text-gray-400" />
                          </div>
                          <div className="flex-1">
                            <p className="text-white font-semibold">
                              {project.name}
                            </p>
                            <p className="text-sm text-gray-500 mt-0.5">
                              {project.description || "Soroban smart contract"}
                            </p>
                          </div>
                          <div className="text-gray-600 group-hover:text-gray-400 transition-colors">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State CTA */}
            {projects.length === 0 && (
              <div className="text-center">
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-white hover:bg-gray-200 text-black rounded-xl transition-all duration-200 font-semibold hover:scale-105"
                >
                  <Plus size={20} />
                  Create Your First Project
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeComponent;
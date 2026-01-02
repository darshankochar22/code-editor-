"use client";

import {
  ChevronRight,
  ChevronLeft,
  Plus,
  Loader,
  FolderOpen,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import type { Project } from "./types";

interface SidebarProps {
  visible: boolean;
  onToggle: () => void;
  projects: Project[];
  isLoading: boolean;
  isCreating: boolean;
  showCreateForm: boolean;
  onToggleCreateForm: () => void;
  newProjectName: string;
  onProjectNameChange: (name: string) => void;
  newProjectDesc: string;
  onProjectDescChange: (desc: string) => void;
  onCreateProject: () => void;
  onDeleteProject: (projectName: string) => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
}

export function Sidebar({
  visible,
  onToggle,
  projects,
  isLoading,
  isCreating,
  showCreateForm,
  onToggleCreateForm,
  newProjectName,
  onProjectNameChange,
  newProjectDesc,
  onProjectDescChange,
  onCreateProject,
  onDeleteProject,
  onKeyPress,
}: SidebarProps) {
  return (
    <>
      <button
        onClick={onToggle}
        className="absolute left-0 top-4 z-20 p-2 hover:bg-white/5 rounded-lg transition-all duration-200"
        title={visible ? "Hide sidebar" : "Show sidebar"}
      >
        {visible ? (
          <ChevronLeft size={20} className="text-gray-500 hover:text-white" />
        ) : (
          <ChevronRight size={20} className="text-gray-500 hover:text-white" />
        )}
      </button>

      {visible && (
        <div className="w-80 border-r border-white/5 dark:bg-black overflow-y-auto">
          <div className="p-4 pt-12">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Projects
              </h2>
              <button
                onClick={onToggleCreateForm}
                className="p-1.5 hover:bg-white/5 rounded-lg transition-all duration-200 group"
                title="New Project"
              >
                <Plus
                  size={16}
                  className="text-gray-500 group-hover:text-white transition-colors"
                />
              </button>
            </div>

            {showCreateForm && (
              <div className="mb-4 p-4 bg-white/2 rounded-xl border border-white/5">
                <input
                  type="text"
                  placeholder="Project name"
                  value={newProjectName}
                  onChange={(e) => onProjectNameChange(e.target.value)}
                  onKeyPress={onKeyPress}
                  className="w-full px-3 py-2 bg-black/60 text-white border border-white/10 rounded-lg mb-2 placeholder-gray-600 focus:outline-none focus:border-white/20 transition-all"
                  disabled={isCreating}
                  autoFocus
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newProjectDesc}
                  onChange={(e) => onProjectDescChange(e.target.value)}
                  onKeyPress={onKeyPress}
                  className="w-full px-3 py-2 bg-black/60 text-white border border-white/10 rounded-lg mb-3 placeholder-gray-600 focus:outline-none focus:border-white/20 transition-all"
                  disabled={isCreating}
                />
                <div className="flex gap-2">
                  <button
                    onClick={onCreateProject}
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
                    onClick={onToggleCreateForm}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

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
                <p className="text-sm mt-1 text-gray-600">
                  Create one to get started
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/editor?project=${encodeURIComponent(project.name)}`}
                  >
                    <div className="p-3 bg-white/2 hover:bg-white/4 rounded-xl border border-white/5 hover:border-white/10 transition-all duration-200 cursor-pointer group">
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
                            onDeleteProject(project.name);
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
      )}
    </>
  );
}

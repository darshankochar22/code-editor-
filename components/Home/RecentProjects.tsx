"use client";

import Link from "next/link";
import { FolderOpen } from "lucide-react";
import type { Project } from "./types";

interface RecentProjectsProps {
  projects: Project[];
}

export function RecentProjects({ projects }: RecentProjectsProps) {
  if (projects.length === 0) return null;

  return (
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
            <div className="p-4 bg-white/2 hover:bg-white/4 rounded-xl border border-white/5 hover:border-white/10 transition-all duration-200 cursor-pointer group">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/5 rounded-xl group-hover:bg-white/10 transition-all">
                  <FolderOpen size={24} className="text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold">{project.name}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {project.description || "Soroban smart contract"}
                  </p>
                </div>
                <div className="text-gray-600 group-hover:text-gray-400 transition-colors">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M7.5 15L12.5 10L7.5 5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

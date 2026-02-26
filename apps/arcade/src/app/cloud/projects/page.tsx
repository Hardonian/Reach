"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  description: string;
  status: "active" | "paused" | "archived";
  workflowCount: number;
  lastRunAt: string | null;
  createdAt: string;
}

function LoadingState() {
  return (
    <div className="p-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-surface rounded w-1/4"></div>
        <div className="h-4 bg-surface rounded w-1/2"></div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-surface rounded"></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorState({ error, retry }: { error: string; retry: () => void }) {
  return (
    <div className="p-8">
      <div className="card border-red-500/30 bg-red-500/5">
        <h2 className="text-lg font-semibold text-red-400 mb-2">Failed to Load Projects</h2>
        <p className="text-gray-400 text-sm mb-4">{error}</p>
        <button onClick={retry} className="btn-secondary text-sm">
          Retry
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card p-12 text-center">
      <div className="text-4xl mb-4">📁</div>
      <h3 className="text-lg font-semibold mb-2">No Projects Yet</h3>
      <p className="text-gray-400 text-sm mb-4 max-w-md mx-auto">
        Projects help you organize workflows, runs, and team access. Create your first project to get started.
      </p>
      <button className="btn-primary">Create Project</button>
    </div>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      setLoading(true);
      setError(null);
      // For now, show empty state - this would connect to /api/v1/projects
      await new Promise((r) => setTimeout(r, 500));
      setProjects([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} retry={fetchProjects} />;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-gray-400 text-sm">Organize your workflows and team access</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <span>+</span>
          New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/cloud/projects/${project.id}`}
              className="card block hover:border-accent/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{project.name}</h3>
                  <p className="text-gray-400 text-sm">{project.description}</p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                      project.status === "active"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : project.status === "paused"
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-gray-500/10 text-gray-400"
                    }`}
                  >
                    {project.status}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

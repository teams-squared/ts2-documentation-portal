"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRightIcon, ChevronDownIcon } from "@/components/icons";
import { useListMorph } from "@/hooks/useListMorph";

export interface SidebarNode {
  id: string;
  name: string;
  children: SidebarNode[];
  courseCount: number;
}

interface CatalogSidebarProps {
  nodes: SidebarNode[];
  activeNodeId: string | null;
}

export function CatalogSidebar({ nodes, activeNodeId }: CatalogSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const morph = useListMorph();
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Auto-expand the path to the active node
    if (!activeNodeId) return new Set<string>();
    const ex = new Set<string>();
    function findPath(nodeList: SidebarNode[], path: string[]): boolean {
      for (const n of nodeList) {
        if (n.id === activeNodeId) {
          for (const id of path) ex.add(id);
          return true;
        }
        if (findPath(n.children, [...path, n.id])) return true;
      }
      return false;
    }
    findPath(nodes, []);
    return ex;
  });

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const navigate = (nodeId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nodeId) {
      params.set("node", nodeId);
    } else {
      params.delete("node");
    }
    // Remove old category param
    params.delete("category");
    const qs = params.toString();
    morph(() => router.push(`/courses${qs ? `?${qs}` : ""}`));
  };

  const renderNode = (node: SidebarNode, depth: number) => {
    const isExpanded = expanded.has(node.id);
    const isActive = activeNodeId === node.id;
    const hasChildren = node.children.length > 0;

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-1 py-1.5 px-2 rounded-lg cursor-pointer transition-colors text-sm ${
            isActive
              ? "bg-primary-subtle text-primary font-medium"
              : "text-foreground-muted dark:text-foreground-subtle hover:bg-surface-muted hover:text-foreground"
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {hasChildren ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggle(node.id); }}
              className="w-4 h-4 flex items-center justify-center flex-shrink-0"
            >
              {isExpanded ? (
                <ChevronDownIcon className="w-3 h-3" />
              ) : (
                <ChevronRightIcon className="w-3 h-3" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <button
            onClick={() => navigate(node.id)}
            className="flex-1 text-left truncate"
          >
            {node.name}
          </button>
          {node.courseCount > 0 && (
            <span className="text-xs text-foreground-subtle tabular-nums">
              {node.courseCount}
            </span>
          )}
        </div>
        {isExpanded &&
          node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <nav className="space-y-0.5">
      {/* "All Courses" option */}
      <button
        onClick={() => navigate(null)}
        className={`w-full flex items-center gap-1 py-1.5 px-2 rounded-lg text-sm transition-colors text-left ${
          !activeNodeId
            ? "bg-primary-subtle text-primary font-medium"
            : "text-foreground-muted dark:text-foreground-subtle hover:bg-surface-muted hover:text-foreground"
        }`}
      >
        <span className="w-4" />
        All Courses
      </button>

      {nodes.map((node) => renderNode(node, 0))}
    </nav>
  );
}

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import toolsConfig from "@/config/tools-config.json";
import type { Tool } from "@/types/tools";

// ─── Dynamic Lucide icon resolver ───────────────────────────────────────────
type IconComponent = React.ComponentType<{ className?: string }>;

function ToolIcon({ name, className }: { name: string; className?: string }) {
  const Icon = (LucideIcons as unknown as Record<string, IconComponent>)[name];
  if (!Icon) return <LucideIcons.Box className={className} />;
  return <Icon className={className} />;
}

// ─── Sidebar Item ────────────────────────────────────────────────────────────
function SidebarItem({
  tool,
  collapsed,
  active,
}: {
  tool: Tool;
  collapsed: boolean;
  active: boolean;
}) {
  const isComingSoon = tool.status === "coming-soon";
  const isBeta = tool.status === "beta";

  return (
    <li>
      <Link
        href={isComingSoon ? "#" : `/tools/${tool.slug}`}
        aria-disabled={isComingSoon}
        title={collapsed ? tool.name : undefined}
        className={cn(
          "flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-primary font-medium"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isComingSoon && "opacity-40 pointer-events-none"
        )}
      >
        <ToolIcon name={tool.icon} className="w-4 h-4 flex-shrink-0" />

        {!collapsed && (
          <>
            <span className="flex-1 truncate">{tool.name}</span>
            {isBeta && <Badge variant="default">BETA</Badge>}
            {isComingSoon && <Badge variant="muted">SOON</Badge>}
          </>
        )}
      </Link>
    </li>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const { tools, categories } = toolsConfig;

  return (
    <aside
      className={cn(
        "flex flex-col h-screen sticky top-0 bg-sidebar border-r border-sidebar-border transition-[width] duration-300 ease-in-out flex-shrink-0",
        collapsed ? "w-14" : "w-60"
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-3 h-14 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <LucideIcons.Zap className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="font-bold text-sidebar-foreground text-base tracking-tight truncate">
            MMG-Dash
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
        {categories.map((category) => {
          const categoryTools = tools.filter(
            (t) => t.category === category.id
          ) as Tool[];

          return (
            <div key={category.id}>
              {!collapsed && (
                <p className="px-2 mb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                  {category.label}
                </p>
              )}
              {collapsed && (
                <div className="h-px bg-sidebar-border mx-1 mb-2" />
              )}
              <ul className="space-y-0.5">
                {categoryTools.map((tool) => (
                  <SidebarItem
                    key={tool.id}
                    tool={tool}
                    collapsed={collapsed}
                    active={pathname === `/tools/${tool.slug}`}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-sidebar-border p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <LucideIcons.PanelLeftOpen className="w-4 h-4" />
          ) : (
            <LucideIcons.PanelLeftClose className="w-4 h-4" />
          )}
        </button>
      </div>
    </aside>
  );
}

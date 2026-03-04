import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import toolsConfig from "@/config/tools-config.json";

export default function Home() {
  const activeTools = toolsConfig.tools.filter((t) => t.status === "active");

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      {/* Hero */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-primary mb-3">
          <Zap className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-widest">
            MMG-Dash
          </span>
        </div>
        <h1 className="text-4xl font-bold text-foreground tracking-tight">
          Your Personal DeFi Command Center
        </h1>
        <p className="text-lg text-muted-foreground">
          Modular on-chain tools — PnL tracking, LP analytics, yield monitoring,
          and more. Connect your wallet to get started.
        </p>
      </div>

      {/* Active Tools Grid */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-4">
          Available Tools
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {activeTools.map((tool) => (
            <Link
              key={tool.id}
              href={`/tools/${tool.slug}`}
              className="group flex items-start gap-4 p-5 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-accent transition-all duration-200"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {tool.name}
                </p>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {tool.description}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all mt-1 flex-shrink-0" />
            </Link>
          ))}
        </div>
      </div>

      {/* Coming Soon */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-4">
          Coming Soon
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {toolsConfig.tools
            .filter((t) => t.status === "coming-soon")
            .map((tool) => (
              <div
                key={tool.id}
                className="p-4 rounded-xl border border-border/50 bg-card/50 opacity-60"
              >
                <p className="font-medium text-foreground text-sm">{tool.name}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {tool.description}
                </p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

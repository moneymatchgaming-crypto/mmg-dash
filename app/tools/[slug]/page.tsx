import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import toolsConfig from "@/config/tools-config.json";

/**
 * Tool Registry — maps slug → dynamic import.
 * Add a new tool here when you create a new component under /components/tools/.
 */
const toolRegistry: Record<string, ReturnType<typeof dynamic>> = {
  "portfolio": dynamic(() => import("@/components/tools/portfolio")),
  "pnl-tracker": dynamic(() => import("@/components/tools/pnl-tracker")),
  "lp-calculator": dynamic(() => import("@/components/tools/lp-calculator")),
};

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function ToolPage({ params }: Props) {
  const { slug } = await params;
  const ToolComponent = toolRegistry[slug];
  const tool = toolsConfig.tools.find((t) => t.slug === slug);

  if (!tool || !ToolComponent) {
    notFound();
  }

  return <ToolComponent />;
}

/** Pre-render routes for active tools at build time */
export function generateStaticParams() {
  return toolsConfig.tools
    .filter((t) => t.status === "active")
    .map((t) => ({ slug: t.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const tool = toolsConfig.tools.find((t) => t.slug === params.slug);
  return {
    title: tool ? `${tool.name} — MMG-Dash` : "MMG-Dash",
    description: tool?.description,
  };
}

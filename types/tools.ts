export interface Tool {
  id: string;
  name: string;
  description: string;
  icon: string;
  slug: string;
  category: string;
  status: 'active' | 'coming-soon' | 'beta';
}

export interface Category {
  id: string;
  label: string;
}

export interface ToolsConfig {
  tools: Tool[];
  categories: Category[];
}

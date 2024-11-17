export interface DependencyNode {
  id: string;
  label: string;
  type: 'file' | 'directory';
  size?: number;
}

export interface DependencyLink {
  source: string;
  target: string;
  type: 'import' | 'export';
}

export interface DependencyData {
  nodes: DependencyNode[];
  links: DependencyLink[];
}
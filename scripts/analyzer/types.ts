export type FileExtension = '.js' | '.jsx' | '.ts' | '.tsx' | '.css' | '.svg' | '.png' | '.jpg' | '.jpeg' | '.gif';

export interface FileChange {
  changedFile: string;
  changeType: 'add' | 'modify' | 'delete';
  modifiedExports?: string[];
}

export interface AnalysisOptions {
  entryFile: string;
  changes: FileChange[];
}

export interface FileNode {
  file: string;
  type: 'js' | 'asset';
  imports?: ImportInfo[];
  exports?: Set<string>;
  isAffected?: boolean;
  changeType?: string;
  reason?: string;
  children: FileNode[];
}

export interface ImportInfo {
  source: string;
  specifiers: Set<string>;
}

export interface FileCache {
  imports: ImportInfo[];
  exports: Set<string>;
}
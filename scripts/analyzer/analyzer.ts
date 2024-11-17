import { AnalysisOptions, FileNode, ImportInfo, FileChange } from './types';
import { isJavaScriptFile, isAssetFile, shouldIgnoreFile, resolveImportPath } from './utils';
import { parseFile } from './parser';
import path from 'path';
import fs from 'fs/promises';

export async function analyzeProject(options: AnalysisOptions): Promise<FileNode> {
  const { entryFile, changes } = options;
  const rootDir = process.cwd();
  
  try {
    await fs.access(entryFile);
    const tree = await buildDependencyTree(entryFile, {
      changes,
      rootDir,
      visited: new Set()
    });
    
    return tree;
  } catch (error) {
    console.error('Error analyzing project:', error);
    throw new Error(`Failed to analyze project: ${error.message}`);
  }
}

async function buildDependencyTree(
  filePath: string,
  context: {
    changes: FileChange[];
    rootDir: string;
    visited: Set<string>;
  }
): Promise<FileNode> {
  const { changes, rootDir, visited } = context;

  if (visited.has(filePath)) {
    return {
      file: filePath,
      type: isJavaScriptFile(filePath) ? 'js' : 'asset',
      children: []
    };
  }

  visited.add(filePath);

  try {
    await fs.access(filePath);
    
    const node: FileNode = {
      file: filePath,
      type: isJavaScriptFile(filePath) ? 'js' : 'asset',
      children: []
    };

    // Check if this is one of the changed files
    const change = changes.find(c => c.changedFile === filePath);
    if (change) {
      node.changeType = change.changeType;
      node.reason = `File was ${change.changeType}d`;
    }

    if (node.type === 'js' && !shouldIgnoreFile(filePath)) {
      try {
        const { imports, exports } = await parseFile(filePath);
        node.imports = imports;
        node.exports = exports;

        // Check if this file is affected by any of the changes
        const affectingChanges = determineAffectingChanges(filePath, {
          changes,
          imports,
          rootDir
        });

        if (affectingChanges.length > 0) {
          node.isAffected = true;
          node.reason = determineImpactReason(filePath, affectingChanges, imports);
        }

        const childPromises = imports.map(async (imp) => {
          const resolvedPath = resolveImportPath(filePath, imp.source, rootDir);
          if (resolvedPath) {
            try {
              await fs.access(resolvedPath);
              return await buildDependencyTree(resolvedPath, context);
            } catch {
              console.warn(`Warning: Could not access imported file: ${resolvedPath}`);
              return null;
            }
          }
          return null;
        });

        const children = (await Promise.all(childPromises)).filter((child): child is FileNode => child !== null);
        node.children = children;
      } catch (error) {
        console.warn(`Warning: Error analyzing file ${filePath}:`, error);
      }
    } else if (node.type === 'asset') {
      const change = changes.find(c => c.changedFile === filePath);
      if (change) {
        node.isAffected = true;
        node.reason = `Asset file was ${change.changeType}d`;
      }
    }

    return node;
  } catch (error) {
    console.warn(`Warning: Could not access file ${filePath}:`, error);
    return {
      file: filePath,
      type: 'asset',
      children: []
    };
  }
}

interface AffectingImport {
  change: FileChange;
  importedSpecifiers: string[];
}

function determineAffectingChanges(
  filePath: string,
  context: {
    changes: FileChange[];
    imports: ImportInfo[];
    rootDir: string;
  }
): AffectingImport[] {
  const { changes, imports, rootDir } = context;
  const affectingChanges: AffectingImport[] = [];

  for (const change of changes) {
    imports.forEach(imp => {
      const resolvedSource = resolveImportPath(filePath, imp.source, rootDir);
      if (resolvedSource === change.changedFile) {
        if (change.changeType === 'modify' && change.modifiedExports?.length) {
          const affectedSpecifiers = Array.from(imp.specifiers)
            .filter(spec => change.modifiedExports?.includes(spec));
          
          if (affectedSpecifiers.length > 0) {
            affectingChanges.push({
              change,
              importedSpecifiers: affectedSpecifiers
            });
          }
        } else {
          affectingChanges.push({
            change,
            importedSpecifiers: Array.from(imp.specifiers)
          });
        }
      }
    });
  }

  return affectingChanges;
}

function determineImpactReason(
  filePath: string,
  affectingChanges: AffectingImport[],
  imports: ImportInfo[]
): string {
  const reasons: string[] = [];

  for (const { change, importedSpecifiers } of affectingChanges) {
    const fileName = path.basename(change.changedFile);
    
    switch (change.changeType) {
      case 'delete':
        reasons.push(`Imported file '${fileName}' was deleted`);
        break;
      
      case 'add':
        reasons.push(`New file '${fileName}' was added that is imported`);
        break;
      
      case 'modify':
        if (change.modifiedExports?.length && importedSpecifiers.length > 0) {
          reasons.push(
            `Modified exports from '${fileName}': ${importedSpecifiers.join(', ')}`
          );
        } else {
          reasons.push(`File '${fileName}' content was modified`);
        }
        break;
    }
  }

  return reasons.join('\n');
}
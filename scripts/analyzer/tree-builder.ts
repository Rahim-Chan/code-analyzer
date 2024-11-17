import { FileNode, ChangeType, ChangeInput, ImpactResult } from './types';
import { FileParser } from './parser';
import * as path from 'path';

export class DependencyTreeBuilder {
  private readonly parser: FileParser;
  private fileMap: Map<string, FileNode> = new Map();

  constructor(rootDir: string, alias: Record<string, string> = {}) {
    this.parser = new FileParser(rootDir, alias);
  }

  public buildTree(entryFile: string): FileNode {
    const root = this.parseAndCacheFile(entryFile);
    this.buildDependencyTree(root);
    return root;
  }

  public analyzeImpact(change: ChangeInput, root: FileNode): ImpactResult {
    const impactResult: ImpactResult = {
      filePath: change.filePath,
      reason: this.getChangeReason(change),
      children: [],
    };

    if (change.changeType === 'delete' || change.changeType === 'add') {
      this.findImpactedFiles(change.filePath, root, impactResult);
    } else if (change.changeType === 'modify' && change.modifiedExports) {
      const fileNode = this.fileMap.get(change.filePath);
      if (fileNode && this.hasExportChanges(fileNode, change.modifiedExports)) {
        this.findImpactedFiles(change.filePath, root, impactResult);
      }
    }

    return impactResult;
  }

  private parseAndCacheFile(filePath: string): FileNode {
    if (this.fileMap.has(filePath)) {
      return this.fileMap.get(filePath)!;
    }

    const node = this.parser.parseFile(filePath);
    this.fileMap.set(filePath, node);
    return node;
  }

  private buildDependencyTree(node: FileNode) {
    for (const importPath of node.imports) {
      const childNode = this.parseAndCacheFile(importPath);
      node.children.push(childNode);
      this.buildDependencyTree(childNode);
    }
  }

  private findImpactedFiles(changedFile: string, currentNode: FileNode, result: ImpactResult) {
    for (const child of currentNode.children) {
      if (child.imports.includes(changedFile)) {
        const childImpact: ImpactResult = {
          filePath: child.path,
          reason: `Imports from ${path.basename(changedFile)}`,
          children: [],
        };
        result.children.push(childImpact);
        this.findImpactedFiles(child.path, currentNode, childImpact);
      } else {
        this.findImpactedFiles(changedFile, child, result);
      }
    }
  }

  private hasExportChanges(fileNode: FileNode, modifiedExports: string[]): boolean {
    return modifiedExports.some(exp => fileNode.exports.includes(exp));
  }

  private getChangeReason(change: ChangeInput): string {
    switch (change.changeType) {
      case 'add':
        return 'New file added';
      case 'delete':
        return 'File deleted';
      case 'modify':
        return `Modified exports: ${change.modifiedExports?.join(', ')}`;
      default:
        return 'Unknown change';
    }
  }
}
import { FileExtension } from './types';
import { JS_EXTENSIONS, IGNORE_PATTERNS } from './constants';
import path from 'path';
import fs from 'fs';

const ASSET_EXTENSIONS = ['.css', '.svg', '.png', '.jpg', '.jpeg', '.gif'];

export function isJavaScriptFile(filePath: string): filePath is `${string}${FileExtension}` {
  return JS_EXTENSIONS.some(ext => filePath.endsWith(ext));
}

export function isAssetFile(filePath: string): boolean {
  return ASSET_EXTENSIONS.some(ext => filePath.endsWith(ext));
}

export function shouldIgnoreFile(filePath: string): boolean {
  return IGNORE_PATTERNS.some(pattern => pattern.test(filePath));
}

export function resolveImportPath(currentFile: string, importPath: string, rootDir: string): string | null {
  if (!importPath.startsWith('.') && !importPath.startsWith('@/')) {
    return null;
  }

  let resolvedPath: string;

  if (importPath.startsWith('@/')) {
    resolvedPath = path.resolve(rootDir, 'src', importPath.slice(2));
  } else {
    resolvedPath = path.resolve(path.dirname(currentFile), importPath);
  }

  // Try exact match first
  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
    return resolvedPath;
  }

  // Try with JavaScript extensions
  for (const ext of JS_EXTENSIONS) {
    const pathWithExt = `${resolvedPath}${ext}`;
    if (fs.existsSync(pathWithExt)) {
      return pathWithExt;
    }
  }

  // Try with asset extensions
  for (const ext of ASSET_EXTENSIONS) {
    const pathWithExt = `${resolvedPath}${ext}`;
    if (fs.existsSync(pathWithExt)) {
      return pathWithExt;
    }
  }

  // Try index files
  for (const ext of JS_EXTENSIONS) {
    const indexPath = path.join(resolvedPath, `index${ext}`);
    if (fs.existsSync(indexPath)) {
      return indexPath;
    }
  }

  return null;
}
import { DependencyContext, ImportInfo } from './types';
import { parseFile, resolveImportPath, isJavaScriptFile } from './parser';

export async function buildDependencyContext(
  entryFile: string,
  rootDir: string,
  ignorePatterns: string[] = []
): Promise<DependencyContext> {
  const context: DependencyContext = {
    dependencies: new Map(),
    reverseDependencies: new Map(),
    exports: new Map(),
    imports: new Map()
  };

  const processedFiles = new Set<string>();
  await processFile(entryFile, context, {
    processedFiles,
    ignorePatterns,
    rootDir
  });

  return context;
}

async function processFile(
  filePath: string,
  context: DependencyContext,
  options: {
    processedFiles: Set<string>;
    ignorePatterns: string[];
    rootDir: string;
  }
): Promise<void> {
  const { processedFiles, ignorePatterns, rootDir } = options;

  if (processedFiles.has(filePath) || shouldIgnoreFile(filePath, ignorePatterns) || !isJavaScriptFile(filePath)) {
    return;
  }

  processedFiles.add(filePath);

  try {
    const { imports, exports } = await parseFile(filePath);
    
    if (!context.dependencies.has(filePath)) {
      context.dependencies.set(filePath, new Set());
    }
    if (!context.reverseDependencies.has(filePath)) {
      context.reverseDependencies.set(filePath, new Set());
    }

    context.exports.set(filePath, exports);
    context.imports.set(filePath, imports);

    for (const imp of imports) {
      const resolvedPath = resolveImportPath(filePath, imp.source, rootDir);
      if (resolvedPath) {
        context.dependencies.get(filePath)?.add(resolvedPath);
        
        if (!context.reverseDependencies.has(resolvedPath)) {
          context.reverseDependencies.set(resolvedPath, new Set());
        }
        context.reverseDependencies.get(resolvedPath)?.add(filePath);

        await processFile(resolvedPath, context, options);
      }
    }
  } catch (error) {
    console.warn(`Error processing file: ${filePath}`, error);
  }
}

function shouldIgnoreFile(filePath: string, ignorePatterns: string[]): boolean {
  return ignorePatterns.some(pattern => 
    new RegExp(pattern).test(filePath) || 
    filePath.includes('node_modules')
  );
}
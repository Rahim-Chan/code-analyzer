import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { readFile } from 'fs/promises';
import { ImportInfo, FileCache } from './types';

const fileCache = new Map<string, FileCache>();

export async function parseFile(filePath: string, content?: string): Promise<FileCache> {
  const cached = fileCache.get(filePath);
  if (cached && !content) return cached;

  const fileContent = content || await readFile(filePath, 'utf-8');
  const ast = parse(fileContent, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });

  const imports: ImportInfo[] = [];
  const exports = new Set<string>();

  traverse.default(ast, {
    ImportDeclaration(path) {
      const importInfo: ImportInfo = {
        source: path.node.source.value,
        specifiers: new Set()
      };

      path.node.specifiers.forEach(specifier => {
        if (specifier.type === 'ImportDefaultSpecifier') {
          importInfo.specifiers.add('default');
        } else if (specifier.type === 'ImportSpecifier') {
          importInfo.specifiers.add(specifier.imported.name);
        }
      });

      imports.push(importInfo);
    },
    ExportNamedDeclaration(path) {
      if (path.node.declaration) {
        const exportName = path.node.declaration.type === 'VariableDeclaration'
          ? path.node.declaration.declarations[0].id.name
          : path.node.declaration.id?.name;
        if (exportName) {
          exports.add(exportName);
        }
      }
      path.node.specifiers.forEach(specifier => {
        exports.add(specifier.exported.name);
      });
    },
    ExportDefaultDeclaration() {
      exports.add('default');
    }
  });

  const result = { imports, exports };
  if (!content) {
    fileCache.set(filePath, result);
  }
  return result;
}
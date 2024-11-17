import { program } from 'commander';
import path from 'path';
import { analyzeProject } from './analyzer';
import type { FileChange, FileNode } from './types';

// Parse command line options
program
  .option('-e, --entry <path>', 'Entry file path', 'src/main.tsx')
  .option('-f, --files <changes>', 'JSON string of file changes', '[]')
  .parse(process.argv);

const options = program.opts();

function getStatusBadge(node: FileNode): string {
  if (node.changeType) {
    return `[${node.changeType.toUpperCase()}]`;
  }
  if (node.isAffected) {
    return '[AFFECTED]';
  }
  return '';
}

function printTree(node: FileNode, prefix = '', isLast = true) {
  const status = getStatusBadge(node);
  const relativePath = path.relative(process.cwd(), node.file);
  const marker = isLast ? '└── ' : '├── ';
  const newPrefix = prefix + (isLast ? '    ' : '│   ');

  // Print the node
  console.log(`${prefix}${marker}${relativePath} ${status}`);

  // Print reason if exists
  if (node.reason) {
    const reasonLines = node.reason.split('\n');
    reasonLines.forEach(line => {
      console.log(`${newPrefix}    → ${line}`);
    });
  }

  // Print children
  if (node.children?.length) {
    node.children
      .sort((a, b) => {
        // Sort by directory/file and then by name
        const aIsDir = a.children?.length > 0;
        const bIsDir = b.children?.length > 0;
        if (aIsDir !== bIsDir) return bIsDir ? -1 : 1;
        return path.basename(a.file).localeCompare(path.basename(b.file));
      })
      .forEach((child, index, array) => {
        printTree(child, newPrefix, index === array.length - 1);
      });
  }
}

async function main() {
  try {
    let changes: FileChange[];
    try {
      changes = JSON.parse(options.files);
    } catch (e) {
      changes = [{
        changedFile: path.resolve(process.cwd(), 'src/pages/Foo/index.tsx'),
        changeType: 'modify',
        modifiedExports: ['FooConst']
      }];
    }

    const result = await analyzeProject({
      entryFile: path.resolve(process.cwd(), options.entry),
      changes: changes.map(change => ({
        ...change,
        changedFile: path.resolve(process.cwd(), change.changedFile)
      }))
    });

    // Print complete dependency tree
    console.log('\nDependency Tree Analysis:');
    console.log('=======================\n');
    printTree(result);
    console.log('\nLegend:');
    console.log('  [MODIFY]   - File was modified');
    console.log('  [DELETE]   - File was deleted');
    console.log('  [ADD]      - File was added');
    console.log('  [AFFECTED] - File is affected by changes');
    console.log('\n→ Indicates impact reason\n');

    // Print impacted files summary
    console.log('Impact Summary:');
    console.log('==============\n');

    // Function to flatten the tree into an array of affected/changed files
    function collectImpactedFiles(node: FileNode, impactedFiles: any[] = []) {
      if (node.changeType || node.isAffected) {
        impactedFiles.push({
          file: path.relative(process.cwd(), node.file),
          status: node.changeType ? node.changeType.toUpperCase() : 'AFFECTED',
          reason: node.reason || '-'
        });
      }
      node.children?.forEach((child: any) => collectImpactedFiles(child, impactedFiles));
      return impactedFiles;
    }

    const impactedFiles = collectImpactedFiles(result);

    if (impactedFiles.length === 0) {
      console.log('No files were impacted by the changes.\n');
      return;
    }

    // Calculate column widths
    const fileWidth = Math.max(...impactedFiles.map(f => f.file.length), 'File'.length);
    const statusWidth = Math.max(...impactedFiles.map(f => f.status.length), 'Status'.length);

    // Print table header
    console.log(
      '┌' + '─'.repeat(fileWidth + 2) +
      '┬' + '─'.repeat(statusWidth + 2) +
      '┬' + '─'.repeat(50) + '┐'
    );
    
    console.log(
      '│ ' + 'File'.padEnd(fileWidth) +
      ' │ ' + 'Status'.padEnd(statusWidth) +
      ' │ ' + 'Impact Reason'.padEnd(48) + ' │'
    );
    
    console.log(
      '├' + '─'.repeat(fileWidth + 2) +
      '┼' + '─'.repeat(statusWidth + 2) +
      '┼' + '─'.repeat(50) + '┤'
    );

    // Print table rows
    impactedFiles.forEach(file => {
      const reasons = file.reason.split('\n');
      reasons.forEach((reason, idx) => {
        if (idx === 0) {
          console.log(
            '│ ' + file.file.padEnd(fileWidth) +
            ' │ ' + file.status.padEnd(statusWidth) +
            ' │ ' + reason.padEnd(48) + ' │'
          );
        } else {
          console.log(
            '│ ' + ''.padEnd(fileWidth) +
            ' │ ' + ''.padEnd(statusWidth) +
            ' │ ' + reason.padEnd(48) + ' │'
          );
        }
      });
    });

    // Print table footer
    console.log(
      '└' + '─'.repeat(fileWidth + 2) +
      '┴' + '─'.repeat(statusWidth + 2) +
      '┴' + '─'.repeat(50) + '┘\n'
    );

  } catch (error: any) {
    console.error('Error analyzing dependencies:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
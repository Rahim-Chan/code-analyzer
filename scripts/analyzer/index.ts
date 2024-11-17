import { program } from 'commander';
import { analyzeProject } from './analyzer';
import path from 'path';

program
  .option('-e, --entry <path>', 'Entry file path')
  .option('-f, --file <path>', 'Changed file path')
  .option('-t, --type <type>', 'Change type (add|modify|delete)')
  .option('-x, --exports <exports>', 'Modified exports (for modify type)')
  .parse(process.argv);

const options = program.opts();

if (!options.entry || !options.file || !options.type) {
  console.error('Missing required options');
  process.exit(1);
}

async function main() {
  try {
    const result = await analyzeProject({
      entryFile: path.resolve(process.cwd(), options.entry),
      changedFile: path.resolve(process.cwd(), options.file),
      changeType: options.type as 'add' | 'modify' | 'delete',
      modifiedExports: options.exports?.split(',') || []
    });

    console.log('\nFile Change Analysis Result:');
    console.log('===========================');
    printTree(result);
  } catch (error) {
    console.error('Analysis failed:', error);
    process.exit(1);
  }
}

function printTree(node: any, prefix = '') {
  const displayPath = node.file === process.cwd() ? '.' : path.relative(process.cwd(), node.file);
  let status = '';
  
  if (node.isAffected) {
    status = '[AFFECTED] ';
  } else if (node.changeType) {
    status = `[${node.changeType.toUpperCase()}] `;
  }

  console.log(`${prefix}${status}${displayPath}`);
  
  if (node.reason) {
    console.log(`${prefix}  └─ ${node.reason}`);
  }
  
  if (node.children?.length) {
    node.children
      .sort((a: any, b: any) => {
        // Directories first, then files
        const aIsDir = a.children.length > 0;
        const bIsDir = b.children.length > 0;
        if (aIsDir !== bIsDir) return bIsDir ? 1 : -1;
        return path.basename(a.file).localeCompare(path.basename(b.file));
      })
      .forEach((child: any, index: number) => {
        const isLast = index === node.children.length - 1;
        printTree(child, `${prefix}${isLast ? '   ' : '│  '}`);
      });
  }
}

main().catch(console.error);
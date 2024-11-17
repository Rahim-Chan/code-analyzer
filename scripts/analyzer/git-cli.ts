import { program } from 'commander';
import { simpleGit } from 'simple-git';
import { spawn } from 'child_process';
import path from 'path';
import { parseFile } from './parser';
import { FileChange } from './types';

program
  .option('-e, --entry <path>', 'Entry file path', 'src/main.tsx')
  .parse(process.argv);

const options = program.opts();

async function getLastCommitChanges(): Promise<FileChange[]> {
  const git = simpleGit();
  const diff = await git.diff(['HEAD^', 'HEAD', '--name-status']);
  
  const changes: FileChange[] = [];
  const lines = diff.split('\n').filter(Boolean);

  for (const line of lines) {
    const [status, filePath] = line.split('\t');
    if (!filePath || !filePath.match(/\.(js|jsx|ts|tsx)$/)) continue;

    const absolutePath = path.resolve(process.cwd(), filePath);
    let changeType: 'add' | 'modify' | 'delete';
    let modifiedExports: string[] = [];

    switch (status[0]) {
      case 'A':
        changeType = 'add';
        break;
      case 'D':
        changeType = 'delete';
        break;
      case 'M':
        changeType = 'modify';
        try {
          // Get previous exports
          const prevExports = new Set<string>();
          const prevContent = await git.show(['HEAD^:' + filePath]);
          if (prevContent) {
            const { exports } = await parseFile(absolutePath, prevContent);
            exports.forEach(exp => prevExports.add(exp));
          }

          // Get current exports
          const { exports: currentExports } = await parseFile(absolutePath);
          
          // Find modified exports by comparing sets
          modifiedExports = Array.from(currentExports).filter(exp => !prevExports.has(exp))
            .concat(Array.from(prevExports).filter(exp => !currentExports.has(exp)));
          
        } catch (error) {
          console.warn(`Warning: Could not analyze exports for ${filePath}:`, error);
        }
        break;
      default:
        continue;
    }

    changes.push({
      changedFile: absolutePath,
      changeType,
      modifiedExports: modifiedExports.length > 0 ? modifiedExports : undefined
    });
  }

  return changes;
}

async function main() {
  try {
    const changes = await getLastCommitChanges();
    
    if (changes.length === 0) {
      console.log('No relevant file changes found in the last commit.');
      return;
    }

    // Run the analyzer CLI with the detected changes
    const analyzerProcess = spawn('npm', [
      'run',
      'analyze',
      '--',
      '-e',
      options.entry,
      '-f',
      JSON.stringify(changes)
    ], {
      stdio: 'inherit',
      shell: true
    });

    analyzerProcess.on('error', (error) => {
      console.error('Failed to run analyzer:', error);
      process.exit(1);
    });

  } catch (error: any) {
    console.error('Error analyzing git changes:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import getPort from 'get-port';
import { analyzeProject } from '../analyzer/analyzer.js';
import { program } from 'commander';
import type { FileChange } from '../analyzer/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse command line options
program
  .option('-e, --entry <path>', 'Entry file path', 'src/main.tsx')
  .option('-f, --files <changes>', 'JSON string of file changes', '[]')
  .parse(process.argv);

const options = program.opts();

async function startServer() {
  const app = express();
  let server: ReturnType<typeof app.listen>;

  function shutdown() {
    console.log('\nShutting down server...');
    if (server) {
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    shutdown();
  });

  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/api/dependencies', async (req, res) => {
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

      if (!result) {
        throw new Error('Analysis returned no results');
      }

      const transformPaths = (node: any) => ({
        ...node,
        file: path.relative(process.cwd(), node.file) || '.',
        children: (node.children || []).map(transformPaths),
      });

      res.json(transformPaths(result));
    } catch (error: any) {
      console.error('Error analyzing dependencies:', error);
      res.status(500).json({
        error: 'Failed to analyze dependencies',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  });

  try {
    const preferredPorts = Array.from({ length: 10 }, (_, i) => 10086 + i);
    const port = await getPort({ port: preferredPorts });
    
    server = app.listen(port, () => {
      console.log(
        `\nDependency visualizer running at http://localhost:${port}`
      );
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { analyzeFileChanges } from './analyzer';

if (!isMainThread) {
  const { options } = workerData;
  
  analyzeFileChanges(options)
    .then(result => parentPort?.postMessage({ type: 'success', result }))
    .catch(error => parentPort?.postMessage({ type: 'error', error: error.message }));
}

export function createAnalyzerWorker(options: any) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: { options }
    });

    worker.on('message', (message) => {
      if (message.type === 'success') {
        resolve(message.result);
      } else {
        reject(new Error(message.error));
      }
    });

    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}
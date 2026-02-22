import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { join } from 'path';

export async function GET() {
  try {
    // Call Python ModelManager to get status
    const result = await new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', [
        join(process.cwd(), '..', 'backend', 'ModelManager.py'),
      ]);

      let output = '';
      let error = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        error += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            // Extract JSON from output (last line should be JSON)
            const lines = output.trim().split('\n');
            const jsonLine = lines[lines.length - 1];
            const status = JSON.parse(jsonLine);
            resolve(status);
          } catch (e) {
            reject(new Error('Failed to parse model status'));
          }
        } else {
          reject(new Error(error || 'ModelManager script failed'));
        }
      });

      pythonProcess.on('error', reject);
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error checking model status:', error);

    // Return default status if check fails
    return NextResponse.json(
      {
        baseModelExists: false,
        finetunedModelExists: false,
        activeModel: null,
        modelVersion: 0,
        lastTrained: null,
        trainingDataCount: 0,
        modelMetadata: null,
        availableVersions: [],
      },
      { status: 500 }
    );
  }
}

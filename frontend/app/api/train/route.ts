import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { spawn } from 'child_process';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const mode = formData.get('mode') as 'quick' | 'full';
    const augment = formData.get('augment') === 'true';

    if (!file || !mode) {
      return NextResponse.json(
        { error: 'Missing file or training mode' },
        { status: 400 }
      );
    }

    // Accumulate training data instead of replacing
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const backendDataDir = join(process.cwd(), '..', 'backend', 'Data', 'Training');
    await mkdir(backendDataDir, { recursive: true });

    const accumulatedPath = join(backendDataDir, 'user_accumulated.csv');
    const newData = buffer.toString('utf-8');

    // Check if accumulated file exists
    let fullData = newData;
    try {
      const { readFileSync } = await import('fs');
      const existing = readFileSync(accumulatedPath, 'utf-8');
      // Append new data (skip header from new data)
      const existingLines = existing.split('\n');
      const newLines = newData.split('\n');
      const header = existingLines[0];
      const existingBody = existingLines.slice(1).join('\n');
      const newBody = newLines.slice(1).join('\n');
      fullData = header + '\n' + existingBody + '\n' + newBody;
    } catch {
      // File doesn't exist, use new data as-is
    }

    await writeFile(accumulatedPath, fullData);
    console.log(`Training CSV accumulated: ${accumulatedPath}`);

    // Determine if we should fine-tune (check if finetuned model exists)
    const { existsSync } = await import('fs');
    const modelsDir = join(process.cwd(), '..', 'backend', 'Models');
    const finetunedDirs = existsSync(modelsDir)
      ? await (await import('fs/promises')).readdir(modelsDir).then(files =>
          files.filter(f => f.startsWith('finetuned-v'))
        )
      : [];

    const fineTune = finetunedDirs && finetunedDirs.length > 0;
    const sourceModel = fineTune
      ? join(modelsDir, finetunedDirs[finetunedDirs.length - 1])
      : '';

    console.log(
      `Training mode: ${fineTune ? 'fine-tuning' : 'training from base'} | Source: ${sourceModel || 'base-v1'}`
    );

    // Return streaming response with real-time logs
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Spawn Python training process with fine-tuning support
          const pythonArgs = [
            join(process.cwd(), '..', 'backend', 'Training', 'trainer.py'),
            accumulatedPath,  // Use accumulated data path
            mode,
            String(augment),
            String(fineTune),  // fine_tune flag
            sourceModel,       // source model path
          ];

          console.log('Training command:', pythonArgs);

          const pythonProcess = spawn('python3', pythonArgs);

          let logCount = 0;
          const totalExpectedLogs = mode === 'quick' ? 15 : 25;

          pythonProcess.stdout.on('data', (data) => {
            const line = data.toString().trim();
            if (line) {
              logCount++;
              const progress = Math.min(95, (logCount / totalExpectedLogs) * 100);
              controller.enqueue(
                new TextEncoder().encode(
                  JSON.stringify({ log: line, progress }) + '\n'
                )
              );
            }
          });

          pythonProcess.stderr.on('data', (data) => {
            const line = data.toString().trim();
            if (line) {
              controller.enqueue(
                new TextEncoder().encode(
                  JSON.stringify({ log: `⚠️  ${line}`, progress: undefined }) + '\n'
                )
              );
            }
          });

          pythonProcess.on('close', (code) => {
            if (code === 0) {
              controller.enqueue(
                new TextEncoder().encode(
                  JSON.stringify({
                    log: '✓ Training complete. Model saved.',
                    progress: 100,
                  }) + '\n'
                )
              );
            } else {
              controller.enqueue(
                new TextEncoder().encode(
                  JSON.stringify({
                    log: `✗ Training failed with code ${code}`,
                    progress: undefined,
                  }) + '\n'
                )
              );
            }
            controller.close();
          });

          pythonProcess.on('error', (error) => {
            console.error('Python process error:', error);
            controller.enqueue(
              new TextEncoder().encode(
                JSON.stringify({
                  log: `✗ Process error: ${error.message}`,
                  progress: undefined,
                }) + '\n'
              )
            );
            controller.close();
          });
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        }
      },
    });

    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('Training error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Training failed' },
      { status: 500 }
    );
  }
}

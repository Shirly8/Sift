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

    // Save training CSV
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const backendDataDir = join(process.cwd(), '..', 'backend', 'Data');
    await mkdir(backendDataDir, { recursive: true });

    const csvPath = join(backendDataDir, 'training_data.csv');
    await writeFile(csvPath, buffer);

    console.log(`Training CSV saved: ${csvPath}`);

    // Return streaming response with real-time logs
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Spawn Python training process
          const pythonProcess = spawn('python3', [
            join(process.cwd(), '..', 'backend', 'Training', 'trainer.py'),
            csvPath,
            mode,
            String(augment),
          ]);

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

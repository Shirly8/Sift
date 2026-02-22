import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const { restaurantName, cuisine, count } = await request.json();

    if (!restaurantName || !cuisine || !count) {
      return NextResponse.json(
        { error: 'Missing required fields: restaurantName, cuisine, count' },
        { status: 400 }
      );
    }

    return new Promise<Response>((resolve) => {
      const pythonProcess = spawn('python3', [
        join(process.cwd(), '..', 'backend', 'Sentiment', 'synthetic_generator.py'),
        'training',
        restaurantName,
        cuisine,
        String(count),
      ]);

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', async (code) => {
        if (code !== 0) {
          console.error('Python error:', stderr);
          resolve(
            NextResponse.json(
              { error: `Generation failed: ${stderr}` },
              { status: 500 }
            )
          );
          return;
        }

        try {
          // Read the generated CSV file
          const csvFileName = `synthetic_${restaurantName.toLowerCase()}.csv`;
          const csvPath = join(process.cwd(), '..', 'backend', 'data', csvFileName);

          const csvContent = await readFile(csvPath);

          // Clean up the file after reading
          await unlink(csvPath).catch(() => {});

          // Return CSV as downloadable file
          resolve(
            new NextResponse(csvContent, {
              headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${restaurantName}_synthetic_data.csv"`,
              },
            })
          );
        } catch (error) {
          console.error('File read error:', error);
          resolve(
            NextResponse.json(
              { error: 'Failed to read generated file' },
              { status: 500 }
            )
          );
        }
      });

      pythonProcess.on('error', (error) => {
        console.error('Process error:', error);
        resolve(
          NextResponse.json(
            { error: `Process error: ${error.message}` },
            { status: 500 }
          )
        );
      });
    });
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { join } from 'path';
import { readdir, readFile, writeFile } from 'fs/promises';

export async function POST(request: NextRequest) {
  try {
    // Run the Python export script to regenerate all dashboard data
    const backendDir = join(process.cwd(), '..');

    await new Promise<void>((resolve, reject) => {
      const exportProcess = spawn('python3',
        ['backend/Scripts/export_dashboard_data.py'],
        { cwd: backendDir }
      );

      let stdoutBuffer = '';

      exportProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('Export script output:', output);
        stdoutBuffer += output;
      });

      exportProcess.stderr.on('data', (data) => {
        console.error('Export script error:', data.toString());
      });

      exportProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Export script exited with code ${code}`));
        }
      });

      exportProcess.on('error', reject);
    });

    // Regenerate restaurants.json by scanning the public/data folder
    const dataDir = join(process.cwd(), 'public', 'data');
    const folders = await readdir(dataDir, { withFileTypes: true });
    const restaurantFolders = folders
      .filter(f => f.isDirectory())
      .map(f => f.name)
      .sort();

    // Write restaurants.json
    const restaurantsPath = join(dataDir, 'restaurants.json');
    await writeFile(restaurantsPath, JSON.stringify(restaurantFolders, null, 2));

    return NextResponse.json({
      success: true,
      message: 'Export completed successfully',
      restaurants: restaurantFolders,
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    );
  }
}

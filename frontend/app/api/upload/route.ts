import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Proper CSV parser that handles quoted fields containing newlines
function parseCSV(content: string): Record<string, string>[] {
  const clean = content.replace(/^\uFEFF/, ''); // remove BOM
  let pos = 0;

  function parseField(): string {
    if (clean[pos] === '"') {
      pos++;
      let val = '';
      while (pos < clean.length) {
        if (clean[pos] === '"' && clean[pos + 1] === '"') {
          val += '"';
          pos += 2;
        } else if (clean[pos] === '"') {
          pos++;
          break;
        } else {
          val += clean[pos++];
        }
      }
      return val;
    } else {
      let val = '';
      while (pos < clean.length && clean[pos] !== ',' && clean[pos] !== '\r' && clean[pos] !== '\n') {
        val += clean[pos++];
      }
      return val;
    }
  }

  function parseRow(): string[] | null {
    while (pos < clean.length && (clean[pos] === '\r' || clean[pos] === '\n')) pos++;
    if (pos >= clean.length) return null;
    const fields: string[] = [];
    while (pos <= clean.length) {
      fields.push(parseField());
      if (pos < clean.length && clean[pos] === ',') {
        pos++;
      } else {
        if (pos < clean.length && clean[pos] === '\r') pos++;
        if (pos < clean.length && clean[pos] === '\n') pos++;
        break;
      }
    }
    return fields;
  }

  const headers = parseRow();
  if (!headers) return [];

  const rows: Record<string, string>[] = [];
  while (pos < clean.length) {
    const row = parseRow();
    if (!row || row.every(f => !f.trim())) continue;
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      record[h.trim()] = row[i] || '';
    });
    rows.push(record);
  }
  return rows;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const restaurantName = formData.get('restaurantName') as string || file.name.replace('.csv', '');

    // Convert to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Determine save path
    const backendDataDir = join(process.cwd(), '..', 'backend', 'Data');
    await mkdir(backendDataDir, { recursive: true });

    // Save the file
    const fileName = `${restaurantName}.csv`;
    const filePath = join(backendDataDir, fileName);
    await writeFile(filePath, buffer);

    // Parse the uploaded CSV to get basic review info right away
    const csvText = buffer.toString('utf-8');
    const rawReviews = parseCSV(csvText);

    // Run the Python export script with the uploaded file
    const backendDir = join(process.cwd(), '..');
    await execAsync(`cd ${backendDir} && python3 backend/Scripts/export_dashboard_data.py "${fileName}"`).catch((err) => {
      console.error('Export script error:', err);
    });

    // Try to read back analyzed review_data.json for richer results
    const folderName = restaurantName.replace(/\s+/g, '_').replace(/'/g, '').replace(/,/g, '');
    const reviewDataPath = join(process.cwd(), 'public', 'data', folderName, 'review_data.json');

    let reviews = rawReviews;
    try {
      const analyzedData = await readFile(reviewDataPath, 'utf-8');
      reviews = JSON.parse(analyzedData);
    } catch {
      // Analysis may not have completed; fall back to raw CSV data
    }

    return NextResponse.json({
      success: true,
      message: 'CSV processed successfully',
      fileName,
      reviews,
      count: reviews.length,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

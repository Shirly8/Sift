import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { readFile } from 'fs/promises';

const execAsync = promisify(exec);

// Proper CSV parser that handles quoted fields containing newlines
function parseCSV(content: string): Record<string, string>[] {
  const clean = content.replace(/^\uFEFF/, ''); // remove BOM
  let pos = 0;

  function parseField(): string {
    if (clean[pos] === '"') {
      pos++; // skip opening quote
      let val = '';
      while (pos < clean.length) {
        if (clean[pos] === '"' && clean[pos + 1] === '"') {
          val += '"';
          pos += 2;
        } else if (clean[pos] === '"') {
          pos++; // skip closing quote
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
    const { restaurantName, cuisine, description, count = 5 } = await request.json();

    if (!restaurantName || !cuisine) {
      return NextResponse.json(
        { error: 'Restaurant name and cuisine are required' },
        { status: 400 }
      );
    }

    // Run synthetic generator
    const backendDir = join(process.cwd(), '..');
    const args = [restaurantName, cuisine, count];
    if (description) {
      args.push(description);
    }
    const command = `cd ${backendDir} && python3 backend/Sentiment/synthetic_generator.py ${args.map(arg => `"${arg}"`).join(' ')}`;

    try {
      await execAsync(command);
    } catch (err) {
      console.error('Generator error:', err);
      return NextResponse.json(
        { error: 'Failed to generate reviews' },
        { status: 500 }
      );
    }

    // Read the generated CSV file
    const fileName = `synthetic_${restaurantName.toLowerCase().replace(/\s+/g, '_')}.csv`;
    const filePath = join(backendDir, 'backend', 'Data', fileName);

    try {
      const csvContent = await readFile(filePath, 'utf-8');
      const reviews = parseCSV(csvContent);

      return NextResponse.json({
        success: true,
        fileName,
        reviews,
        count: reviews.length,
      });
    } catch (err) {
      console.error('Read file error:', err);
      return NextResponse.json(
        { error: 'Failed to read generated file' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Generate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}

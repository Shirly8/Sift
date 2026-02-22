import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

// Read .env file to get LLM settings
async function readEnvFile(): Promise<Record<string, string>> {
  try {
    const envPath = join(process.cwd(), '..', '.env');
    if (!existsSync(envPath)) return {};
    const content = await readFile(envPath, 'utf-8');
    const values: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      values[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
    return values;
  } catch {
    return {};
  }
}

function parseCSV(content: string): Record<string, string>[] {
  const clean = content.replace(/^\uFEFF/, '');
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
    const { restaurantName, cuisine, description, count = 5 } = await request.json();

    if (!restaurantName || !cuisine) {
      return NextResponse.json(
        { error: 'Restaurant name and cuisine are required' },
        { status: 400 }
      );
    }

    const backendDir = join(process.cwd(), '..');
    const args = ['training', restaurantName, cuisine, String(count)];
    if (description) args.push(description);

    const command = `cd "${backendDir}" && python3 backend/Sentiment/synthetic_generator.py ${args.map(a => `"${a}"`).join(' ')}`;

    try {
      // Read saved settings and pass to subprocess
      const envSettings = await readEnvFile();
      const env = {
        ...process.env,
        LLM_MODEL: envSettings.LLM_MODEL || process.env.LLM_MODEL || '',
        LLM_API_KEY: envSettings.LLM_API_KEY || process.env.LLM_API_KEY || '',
        LLM_BASE_URL: envSettings.LLM_BASE_URL || process.env.LLM_BASE_URL || 'http://localhost:11434',
      };
      await execAsync(command, { env });
    } catch (err) {
      console.error('Generator error:', err);
      return NextResponse.json({ error: 'Failed to generate training data' }, { status: 500 });
    }

    const filePath = join(backendDir, 'backend', 'data', 'synthetic_training.csv');

    try {
      const csvContent = await readFile(filePath, 'utf-8');
      const rows = parseCSV(csvContent);

      if (rows.length === 0) {
        return NextResponse.json(
          { error: 'No training data was generated. Please check your LLM configuration in Settings.' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        fileName: 'synthetic_training.csv',
        rows,
        count: rows.length,
      });
    } catch (err) {
      console.error('Read file error:', err);
      return NextResponse.json(
        { error: 'Generation failed - the LLM may not be configured or responding. Please check Settings and ensure your LLM is running.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Generate-training error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}

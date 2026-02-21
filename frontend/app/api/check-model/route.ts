import { NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { join } from 'path';

export async function GET() {
  try {
    // Check if trained model exists in backend Models directory
    const modelPath = join(process.cwd(), '..', 'backend', 'Models', 'trained_model');
    const exists = existsSync(modelPath);

    return NextResponse.json({ exists });
  } catch (error) {
    console.error('Error checking model:', error);
    return NextResponse.json({ exists: false });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { join } from 'path';

export async function GET(request: NextRequest) {
  try {
    // Check if backend directory and key Python files exist
    const backendDir = join(process.cwd(), '..', 'backend');
    const semanticAnalyzer = join(backendDir, 'Sentiment', 'semantic_analyzer.py');
    const trainer = join(backendDir, 'Training', 'trainer.py');
    const exportScript = join(backendDir, 'Scripts', 'export_dashboard_data.py');

    const hasBackend =
      existsSync(backendDir) &&
      existsSync(semanticAnalyzer) &&
      existsSync(trainer) &&
      existsSync(exportScript);

    return NextResponse.json({ available: hasBackend });
  } catch (error) {
    return NextResponse.json({ available: false });
  }
}

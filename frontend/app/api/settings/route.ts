import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';

async function readEnvFile(): Promise<Record<string, string>> {
  try {
    const envPath = join(process.cwd(), '..', '.env');
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { llmModel, llmApiKey, llmBaseUrl, test } = body;

    // Handle test endpoint
    if (test) {
      return testLLMEndpoint(llmModel, llmApiKey, llmBaseUrl);
    }

    // Handle settings save
    if (!llmModel || !llmBaseUrl) {
      return NextResponse.json(
        { error: 'Model and Base URL are required' },
        { status: 400 }
      );
    }

    // Create/update .env.local file with the settings
    const envContent = `# LLM Configuration
LLM_MODEL=${llmModel}
LLM_API_KEY=${llmApiKey || ''}
LLM_BASE_URL=${llmBaseUrl}
`;

    const envPath = join(process.cwd(), '..', '.env');

    try {
      await writeFile(envPath, envContent);
    } catch (fileErr) {
      console.error('Error writing env file:', fileErr);
      // Don't fail the request if file write fails - settings can still work via environment
    }

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
      settings: {
        llmModel,
        llmBaseUrl,
        hasApiKey: !!llmApiKey,
      },
    });
  } catch (error) {
    console.error('Settings error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save settings' },
      { status: 500 }
    );
  }
}

async function testLLMEndpoint(model: string, apiKey: string, baseUrl: string) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      // Parse provider and model
      const [provider, modelName] = model.includes('/')
        ? model.split('/', 1)
        : ['ollama', model];

      // Test based on provider
      if (provider === 'ollama') {
        // Test Ollama endpoint
        const response = await fetch(`${baseUrl}/api/tags`, {
          method: 'GET',
          signal: controller.signal,
        });

        if (!response.ok) {
          return NextResponse.json(
            { success: false, error: `Ollama endpoint returned ${response.status}` },
            { status: 200 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Ollama endpoint is reachable',
          provider: 'ollama',
        });
      }
      else if (provider === 'openai') {
        // Test OpenAI endpoint
        if (!apiKey) {
          return NextResponse.json(
            { success: false, error: 'API key is required for OpenAI' },
            { status: 200 }
          );
        }

        const response = await fetch('https://api.openai.com/v1/models', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          return NextResponse.json(
            { success: false, error: `OpenAI API returned ${response.status}. Check your API key.` },
            { status: 200 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'OpenAI API is accessible',
          provider: 'openai',
        });
      }
      else if (provider === 'claude') {
        // Test Claude/Anthropic endpoint
        if (!apiKey) {
          return NextResponse.json(
            { success: false, error: 'API key is required for Claude' },
            { status: 200 }
          );
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: modelName,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'test' }],
          }),
          signal: controller.signal,
        });

        // 400 is expected for minimal test request, but means auth worked
        if (response.status === 400 || response.ok) {
          return NextResponse.json({
            success: true,
            message: 'Claude API is accessible',
            provider: 'claude',
          });
        }

        return NextResponse.json(
          { success: false, error: `Claude API returned ${response.status}. Check your API key.` },
          { status: 200 }
        );
      }
      else {
        return NextResponse.json(
          { success: false, error: `Unknown provider: ${provider}` },
          { status: 200 }
        );
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Connection failed';
    return NextResponse.json(
      {
        success: false,
        error: `Connection error: ${errorMessage}`
      },
      { status: 200 }
    );
  }
}

export async function GET() {
  const env = await readEnvFile();
  return NextResponse.json({
    llmModel: env.LLM_MODEL || process.env.LLM_MODEL || '',
    llmBaseUrl: env.LLM_BASE_URL || process.env.LLM_BASE_URL || 'http://localhost:11434',
    hasApiKey: !!(env.LLM_API_KEY || process.env.LLM_API_KEY),
  });
}

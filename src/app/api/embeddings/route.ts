import { NextRequest, NextResponse } from 'next/server';
import { resolveKey } from '@/lib/resolve-api-key';

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';
const EMBEDDING_MODEL = 'text-embedding-3-small';

export async function POST(req: NextRequest) {
  const apiKey = resolveKey(req, 'x-openai-key', 'OPENAI_API_KEY');
  if (!apiKey) {
    return NextResponse.json({ error: 'OpenAI API key required' }, { status: 401 });
  }

  const { texts } = await req.json() as { texts: string[] };
  if (!Array.isArray(texts) || texts.length === 0) {
    return NextResponse.json({ error: 'texts array required' }, { status: 400 });
  }

  const response = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      { error: `OpenAI error: ${errorText}` },
      { status: response.status }
    );
  }

  const data = await response.json();
  const embeddings = data.data.map((item: { embedding: number[] }) => item.embedding);

  return NextResponse.json({
    embeddings,
    usage: data.usage,
    model: EMBEDDING_MODEL,
  });
}

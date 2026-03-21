import { NextRequest, NextResponse } from 'next/server';
import { resolveKey } from '@/lib/resolve-api-key';

export async function POST(req: NextRequest) {
  const apiToken = resolveKey(req, 'x-replicate-key', 'REPLICATE_API_TOKEN');
  if (!apiToken) {
    return NextResponse.json({ error: 'Replicate API token required' }, { status: 401 });
  }

  try {
    const { title, description, rules, imageStyle } = await req.json() as {
      title: string;
      description?: string;
      rules?: string[];
      imageStyle?: string;
    };

    // Build an evocative image prompt from narrative context
    const context = [description, rules?.length ? `World rules: ${rules.join('. ')}` : ''].filter(Boolean).join('. ');
    const styleDirective = imageStyle || 'Cinematic wide-angle digital painting, book cover art style';
    const imagePrompt = `${styleDirective}. ${title}. ${context}. Dramatic lighting, rich atmosphere, high detail, no text, no letters, no words, no watermarks.`;

    // Call Replicate Seedream 4.5 with sync mode
    const response = await fetch('https://api.replicate.com/v1/models/bytedance/seedream-4.5/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
        'Prefer': 'wait',
      },
      body: JSON.stringify({
        input: {
          prompt: imagePrompt,
          num_outputs: 1,
          aspect_ratio: '3:4',
          output_format: 'webp',
          output_quality: 80,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-cover] Replicate error:', errorText);
      return NextResponse.json({ error: `Replicate error: ${errorText}` }, { status: response.status });
    }

    const data = await response.json();

    // Replicate returns output as an array of URLs
    const replicateUrl = Array.isArray(data.output) ? data.output[0] : data.output;

    if (!replicateUrl) {
      return NextResponse.json({ error: 'No image generated' }, { status: 500 });
    }

    // Fetch the image and convert to base64 data URL so it persists in localStorage
    const imgRes = await fetch(replicateUrl);
    if (!imgRes.ok) return NextResponse.json({ error: 'Failed to fetch generated image' }, { status: 500 });
    const imgBuffer = await imgRes.arrayBuffer();
    const contentType = imgRes.headers.get('content-type') || 'image/webp';
    const base64 = Buffer.from(imgBuffer).toString('base64');
    const imageUrl = `data:${contentType};base64,${base64}`;

    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error('[generate-cover] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

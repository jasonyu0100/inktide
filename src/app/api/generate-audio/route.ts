import { NextRequest, NextResponse } from 'next/server';
import { resolveKey } from '@/lib/resolve-api-key';

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

type DesignRequest = {
  action: 'design';
  voiceDescription: string;
  previewText: string;
};

type AddVoiceRequest = {
  action: 'add-voice';
  generatedVoiceId: string;
  voiceName: string;
  voiceDescription: string;
};

type GenerateRequest = {
  action: 'generate';
  voiceId: string;
  text: string;
  modelId?: string;
};

export async function POST(req: NextRequest) {
  const apiKey = resolveKey(req, 'x-elevenlabs-key', 'ELEVEN_LABS_API_KEY');
  if (!apiKey) {
    return NextResponse.json({ error: 'ElevenLabs API key required' }, { status: 401 });
  }

  try {
    const body = await req.json() as DesignRequest | AddVoiceRequest | GenerateRequest;

    if (body.action === 'design') {
      // Design a voice from description — returns previews with generated_voice_id
      const res = await fetch(`${ELEVENLABS_BASE}/text-to-voice/create-previews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          voice_description: body.voiceDescription,
          text: body.previewText.slice(0, 1000),
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: `ElevenLabs voice design failed: ${err}` }, { status: res.status });
      }

      const data = await res.json();
      return NextResponse.json(data);
    }

    if (body.action === 'add-voice') {
      // Save a generated preview voice to the user's ElevenLabs library
      const res = await fetch(`${ELEVENLABS_BASE}/text-to-voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          voice_name: body.voiceName,
          voice_description: body.voiceDescription,
          generated_voice_id: body.generatedVoiceId,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: `ElevenLabs add voice failed: ${err}` }, { status: res.status });
      }

      const data = await res.json();
      return NextResponse.json({ voiceId: data.voice_id });
    }

    if (body.action === 'generate') {
      // Generate speech for a text chunk using a voice ID
      const modelId = body.modelId || 'eleven_multilingual_v2';
      const res = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${body.voiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: body.text,
          model_id: modelId,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: `ElevenLabs TTS failed: ${err}` }, { status: res.status });
      }

      const audioBuffer = await res.arrayBuffer();
      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(audioBuffer.byteLength),
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[generate-audio]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

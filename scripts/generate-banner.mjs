import 'dotenv/config';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPLICATE_URL = 'https://api.replicate.com/v1/models/bytedance/seedream-4.5/predictions';

const replicateToken = process.env.REPLICATE_API_TOKEN;

if (!replicateToken) {
  console.error('Error: REPLICATE_API_TOKEN not found in environment');
  process.exit(1);
}

// Narrative-themed prompt for InkTide cover - abstract 2D collage style with inked pages
const prompt = `
Abstract 2D collage of overlapping inked manuscript pages and writing in pure black and white aesthetic.
Multiple fragmented pages at different angles, some with visible handwritten text, flowing script, scattered words.
Flat geometric design, minimalist style. Ink strokes, pen marks, flowing calligraphy rendered as elegant silhouettes.
Layered composition with pages creating dynamic depth - some rotated, some faded, edges visible.
Narrative flow suggested through scattered text fragments, script lines, and writing patterns.
Strict monochrome palette: pure black ink, pure white paper, rich grays. No colors.
Modern, clean, professional graphic design. Collage composition. Ultra high quality, artistic.
`.trim();

console.log('Generating narrative-themed cover with Seedream 4.5...');
console.log('Prompt:', prompt);

const response = await fetch(REPLICATE_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${replicateToken}`,
    'Prefer': 'wait',
  },
  body: JSON.stringify({
    input: {
      prompt: prompt,
      num_outputs: 1,
      aspect_ratio: '21:9',
      output_format: 'png',
      output_quality: 100,
    },
  }),
});

if (!response.ok) {
  const errorText = await response.text();
  console.error('Replicate API error:', errorText);
  process.exit(1);
}

const data = await response.json();
const imageUrl = Array.isArray(data.output) ? data.output[0] : data.output;

if (!imageUrl) {
  console.error('No image URL returned from Replicate');
  process.exit(1);
}

console.log('Image generated:', imageUrl);
console.log('Downloading...');

// Download the image
const imgResponse = await fetch(imageUrl);
if (!imgResponse.ok) {
  console.error('Failed to download image');
  process.exit(1);
}

const imageBuffer = await imgResponse.arrayBuffer();
const outputPath = join(__dirname, '..', 'public', 'readme-banner.png');
writeFileSync(outputPath, Buffer.from(imageBuffer));

console.log('✓ Narrative banner saved to public/readme-banner.png');

/**
 * Package Import - Import .inktide ZIP packages
 *
 * Unpacks ZIP archives and restores narrative + assets to IndexedDB
 */

import JSZip from 'jszip';
import { assetManager } from './asset-manager';
import type { NarrativeState } from '@/types/narrative';
import type { PackageManifest } from './package-export';

// ── Import Options ────────────────────────────────────────────────────────────

export type ImportOptions = {
  importEmbeddings: boolean;
  importAudio: boolean;
  importImages: boolean;
};

export const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  importEmbeddings: true,
  importAudio: true,
  importImages: true,
};

// ── Helper Functions ──────────────────────────────────────────────────────────

/**
 * Read and parse the package manifest
 * Used to show preview before import
 */
export async function readPackageManifest(file: File): Promise<PackageManifest> {
  // Convert File to ArrayBuffer for better Node.js compatibility
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    throw new Error('Invalid .inktide file: missing manifest.json');
  }

  const manifestText = await manifestFile.async('text');
  return JSON.parse(manifestText) as PackageManifest;
}

/**
 * Check if a file is a valid .inktide package
 */
export async function validatePackage(file: File): Promise<{ valid: boolean; error?: string }> {
  try {
    // Convert to ArrayBuffer for Node.js compatibility
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Check for required files
    if (!zip.file('manifest.json')) {
      return { valid: false, error: 'Missing manifest.json' };
    }

    if (!zip.file('narrative.json')) {
      return { valid: false, error: 'Missing narrative.json' };
    }

    // Try to parse manifest
    const manifestFile = zip.file('manifest.json');
    if (manifestFile) {
      const manifestText = await manifestFile.async('text');
      const manifest = JSON.parse(manifestText);

      if (!manifest.version || !manifest.narrative) {
        return { valid: false, error: 'Invalid manifest structure' };
      }
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ── Main Import Function ──────────────────────────────────────────────────────

/**
 * Import narrative from .inktide package
 *
 * Process:
 * 1. Unzip archive
 * 2. Read narrative.json
 * 3. Import selected assets to IndexedDB
 * 4. Return narrative (with asset references intact)
 *
 * @param file .inktide ZIP file
 * @param options Import options (what to include)
 * @param onProgress Optional progress callback
 * @returns Restored narrative state
 */
export async function importFromPackage(
  file: File,
  options: ImportOptions = DEFAULT_IMPORT_OPTIONS,
  onProgress?: (status: string, percent: number) => void,
): Promise<NarrativeState> {
  onProgress?.('Loading package...', 0);

  // 1. Load ZIP (convert to ArrayBuffer for Node.js compatibility)
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  onProgress?.('Reading narrative...', 5);

  // 2. Read narrative.json
  const narrativeFile = zip.file('narrative.json');
  if (!narrativeFile) {
    throw new Error('Invalid .inktide file: missing narrative.json');
  }

  const narrativeText = await narrativeFile.async('text');
  const narrative = JSON.parse(narrativeText) as NarrativeState;

  // 3. Import embeddings
  if (options.importEmbeddings) {
    const embeddingsFolder = zip.folder('embeddings');

    if (embeddingsFolder) {
      const files = Object.values(embeddingsFolder.files).filter(f => !f.dir && f.name.endsWith('.bin'));

      onProgress?.('Importing embeddings...', 10);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = file.name.split('/').pop()!;
        const embId = fileName.replace('.bin', '');

        try {
          // Read binary Float32Array
          const buffer = await file.async('arraybuffer');
          const float32Array = new Float32Array(buffer);
          const vector = Array.from(float32Array);

          // Store in IndexedDB with original ID (preserves references in narrative)
          await assetManager.storeEmbedding(vector, 'text-embedding-3-small', embId);

          if (i % 100 === 0) {
            const percent = 10 + (i / files.length) * 60;
            onProgress?.(`Importing embeddings: ${i}/${files.length}`, percent);
          }
        } catch (error) {
          console.warn(`Failed to import embedding ${embId}:`, error);
        }
      }

      onProgress?.(`Imported ${files.length} embeddings`, 70);
    }
  }

  // 4. Import audio
  if (options.importAudio) {
    const audioFolder = zip.folder('audio');

    if (audioFolder) {
      const files = Object.values(audioFolder.files).filter(f => !f.dir);

      onProgress?.('Importing audio...', 70);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = file.name.split('/').pop()!;
        const [audioId] = fileName.split('.');

        try {
          const blob = await file.async('blob');

          // Store in IndexedDB with original ID
          await assetManager.storeAudio(blob, blob.type, audioId);

          if (i % 10 === 0) {
            const percent = 70 + (i / files.length) * 15;
            onProgress?.(`Importing audio: ${i}/${files.length}`, percent);
          }
        } catch (error) {
          console.warn(`Failed to import audio ${audioId}:`, error);
        }
      }

      onProgress?.(`Imported ${files.length} audio clips`, 85);
    }
  }

  // 5. Import images
  if (options.importImages) {
    const imagesFolder = zip.folder('images');

    if (imagesFolder) {
      const files = Object.values(imagesFolder.files).filter(f => !f.dir);

      onProgress?.('Importing images...', 85);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = file.name.split('/').pop()!;
        const [imgId] = fileName.split('.');

        try {
          const blob = await file.async('blob');

          // Store in IndexedDB with original ID
          await assetManager.storeImage(blob, blob.type, imgId);

          if (i % 10 === 0) {
            const percent = 85 + (i / files.length) * 15;
            onProgress?.(`Importing images: ${i}/${files.length}`, percent);
          }
        } catch (error) {
          console.warn(`Failed to import image ${imgId}:`, error);
        }
      }

      onProgress?.(`Imported ${files.length} images`, 100);
    }
  }

  onProgress?.('Complete!', 100);

  return narrative;
}

/**
 * Get package info without importing
 * Useful for showing preview/confirmation dialog
 */
export async function getPackageInfo(file: File): Promise<{
  manifest: PackageManifest;
  sizes: {
    narrative: number;
    embeddings: number;
    audio: number;
    images: number;
    total: number;
  };
}> {
  // Convert to ArrayBuffer for Node.js compatibility
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const manifest = await readPackageManifest(file);

  let narrativeSize = 0;
  let embeddingsSize = 0;
  let audioSize = 0;
  let imagesSize = 0;

  // Calculate sizes
  const narrativeFile = zip.file('narrative.json');
  if (narrativeFile) {
    const content = await narrativeFile.async('arraybuffer');
    narrativeSize = content.byteLength;
  }

  const embeddingsFolder = zip.folder('embeddings');
  if (embeddingsFolder) {
    for (const file of Object.values(embeddingsFolder.files)) {
      if (!file.dir) {
        const content = await file.async('arraybuffer');
        embeddingsSize += content.byteLength;
      }
    }
  }

  const audioFolder = zip.folder('audio');
  if (audioFolder) {
    for (const file of Object.values(audioFolder.files)) {
      if (!file.dir) {
        const content = await file.async('arraybuffer');
        audioSize += content.byteLength;
      }
    }
  }

  const imagesFolder = zip.folder('images');
  if (imagesFolder) {
    for (const file of Object.values(imagesFolder.files)) {
      if (!file.dir) {
        const content = await file.async('arraybuffer');
        imagesSize += content.byteLength;
      }
    }
  }

  return {
    manifest,
    sizes: {
      narrative: narrativeSize,
      embeddings: embeddingsSize,
      audio: audioSize,
      images: imagesSize,
      total: narrativeSize + embeddingsSize + audioSize + imagesSize,
    },
  };
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

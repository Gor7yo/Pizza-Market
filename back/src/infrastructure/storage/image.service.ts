import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { UploadResultDto } from '@market/shared';
import sharp from 'sharp';
import { AppException } from '../../common/errors/app.exception';
import { FileStorage } from './file-storage';

export const IMAGE_KINDS = ['product', 'ingredient', 'avatar'] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif']);

const PRESETS: Record<ImageKind, { size: number; fit: 'inside' | 'cover' }> = {
  product: { size: 1600, fit: 'inside' },
  ingredient: { size: 400, fit: 'inside' },
  avatar: { size: 512, fit: 'cover' },
};

/**
 * Validates uploads by decoding them (not by trusting mimetype/extension),
 * strips metadata, normalizes orientation, resizes and re-encodes to WebP.
 */
@Injectable()
export class ImageService {
  constructor(private readonly storage: FileStorage) {}

  async upload(kind: ImageKind, input: Buffer): Promise<UploadResultDto> {
    if (input.length === 0 || input.length > MAX_UPLOAD_BYTES) {
      throw AppException.badRequest('INVALID_FILE', 'File is empty or too large');
    }

    let format: string | undefined;
    try {
      format = (await sharp(input, { limitInputPixels: 40_000_000 }).metadata()).format;
    } catch {
      throw AppException.badRequest('INVALID_FILE', 'File is not a valid image');
    }
    if (!format || !ALLOWED_FORMATS.has(format)) {
      throw AppException.badRequest('INVALID_FILE', 'Unsupported image format');
    }

    const preset = PRESETS[kind];
    const { data, info } = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({
        width: preset.size,
        height: preset.size,
        fit: preset.fit,
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    const key = `${kind}/${new Date().getUTCFullYear()}/${randomUUID()}.webp`;
    await this.storage.put(key, data, 'image/webp');

    return {
      key,
      url: this.storage.publicUrl(key),
      width: info.width,
      height: info.height,
      size: info.size,
    };
  }

  async remove(key: string | null | undefined): Promise<void> {
    if (key) await this.storage.delete(key);
  }
}

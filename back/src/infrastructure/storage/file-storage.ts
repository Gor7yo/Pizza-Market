/**
 * Storage abstraction. Business code depends on this class only;
 * S3FileStorage works with AWS S3, Cloudflare R2, SeaweedFS, MinIO, etc.
 */
export abstract class FileStorage {
  abstract put(key: string, body: Buffer, contentType: string): Promise<void>;
  abstract delete(key: string): Promise<void>;
  /** Public URL of an object. Absolute URLs (seed data) are returned unchanged. */
  abstract publicUrl(key: string): string;

  urlOrNull(key: string | null | undefined): string | null {
    return key ? this.publicUrl(key) : null;
  }
}

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service';
import { FileStorage } from './file-storage';

@Injectable()
export class S3FileStorage extends FileStorage implements OnModuleInit {
  private readonly logger = new Logger(S3FileStorage.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly autoCreateBucket: boolean;

  constructor(config: AppConfig) {
    super();
    this.bucket = config.get('S3_BUCKET');
    this.publicBaseUrl = config.get('S3_PUBLIC_URL').replace(/\/$/, '');
    this.autoCreateBucket = config.get('S3_AUTO_CREATE_BUCKET');
    this.client = new S3Client({
      region: config.get('S3_REGION'),
      endpoint: config.get('S3_ENDPOINT'),
      forcePathStyle: config.get('S3_FORCE_PATH_STYLE'),
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY_ID'),
        secretAccessKey: config.get('S3_SECRET_ACCESS_KEY'),
      },
    });
  }

  /**
   * Local development convenience: creates the bucket if it is missing.
   * Never fatal - storage problems must not prevent the API from starting.
   */
  async onModuleInit(): Promise<void> {
    if (!this.autoCreateBucket) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Created bucket "${this.bucket}"`);
      } catch (err) {
        this.logger.warn(`Bucket "${this.bucket}" is not available: ${(err as Error).message}`);
      }
    }
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // keys are content-unique (uuid), so objects can be cached forever
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  async delete(key: string): Promise<void> {
    if (/^https?:\/\//.test(key)) return;
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  publicUrl(key: string): string {
    if (/^https?:\/\//.test(key)) return key;
    return `${this.publicBaseUrl}/${key}`;
  }
}

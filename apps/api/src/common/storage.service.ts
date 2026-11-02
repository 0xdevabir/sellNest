import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { env } from '../config/env';

/** The rest of the app only uses these operations, so another provider can replace S3. */
export interface ObjectStorage {
  readonly enabled: boolean;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  deleteMany(keys: string[]): Promise<void>;
  publicUrl(key: string): string;
}

@Injectable()
export class StorageService implements ObjectStorage, OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket = env().S3_BUCKET;
  private readonly baseUrl = env().S3_PUBLIC_URL?.replace(/\/$/, '') ?? '';
  private readonly client?: S3Client;

  constructor() {
    const e = env();
    if (!e.S3_BUCKET) return;
    this.client = new S3Client({
      region: e.S3_REGION,
      endpoint: e.S3_ENDPOINT,
      forcePathStyle: e.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: e.S3_ACCESS_KEY_ID!, secretAccessKey: e.S3_SECRET_ACCESS_KEY! },
    });
  }

  get enabled() {
    return Boolean(this.client);
  }

  async onModuleInit() {
    if (!this.client) {
      this.logger.warn('Object storage is not configured. Image uploads are disabled.');
      return;
    }
    if (env().NODE_ENV === 'production') return;
    // Development convenience only: production buckets are provisioned explicitly.
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client
        .send(new CreateBucketCommand({ Bucket: this.bucket }))
        .catch((e) => this.logger.warn(`Could not create bucket: ${(e as Error).message}`));
    }
  }

  async put(key: string, body: Buffer, contentType: string) {
    if (!this.client) throw new ServiceUnavailableException('Image uploads are not set up yet');
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Keys are random and contents never change, so caches can keep objects indefinitely.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  async deleteMany(keys: string[]) {
    if (!this.client || keys.length === 0) return;
    for (let i = 0; i < keys.length; i += 1000) {
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
  }

  publicUrl(key: string) {
    return `${this.baseUrl}/${key}`;
  }
}

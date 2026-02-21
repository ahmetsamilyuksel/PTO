import * as Minio from 'minio';
import { config } from '../config';
import { Readable } from 'stream';

let minioClient: Minio.Client | null = null;
let minioReady = false;

export async function initMinIO() {
  try {
    minioClient = new Minio.Client({
      endPoint: config.minio.endpoint,
      port: config.minio.port,
      useSSL: config.minio.useSSL,
      accessKey: config.minio.accessKey,
      secretKey: config.minio.secretKey,
    });

    const bucketExists = await minioClient.bucketExists(config.minio.bucket);
    if (!bucketExists) {
      await minioClient.makeBucket(config.minio.bucket);
      console.log(`Bucket ${config.minio.bucket} created`);
    }
    minioReady = true;
  } catch (err) {
    console.warn('[storage] MinIO not available, file operations will be disabled:', err instanceof Error ? err.message : String(err));
    minioReady = false;
  }
}

function ensureMinIO(): Minio.Client {
  if (!minioClient || !minioReady) {
    throw new Error('File storage is not configured. Set MINIO_ENDPOINT or use S3-compatible storage.');
  }
  return minioClient;
}

export function isStorageReady(): boolean {
  return minioReady;
}

export async function uploadFile(
  objectName: string,
  buffer: Buffer,
  contentType?: string
): Promise<string> {
  const client = ensureMinIO();
  const metaData = contentType ? { 'Content-Type': contentType } : {};
  await client.putObject(config.minio.bucket, objectName, buffer, buffer.length, metaData);
  return objectName;
}

export async function downloadFile(objectName: string): Promise<Buffer> {
  const client = ensureMinIO();
  const stream = await client.getObject(config.minio.bucket, objectName);
  return streamToBuffer(stream as Readable);
}

export async function deleteFile(objectName: string): Promise<void> {
  const client = ensureMinIO();
  await client.removeObject(config.minio.bucket, objectName);
}

export async function getFileUrl(objectName: string, expiry = 3600): Promise<string> {
  const client = ensureMinIO();
  return client.presignedGetObject(config.minio.bucket, objectName, expiry);
}

function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export { minioClient };

import * as Minio from 'minio';
import { config } from '../config';
import { Readable } from 'stream';

let minioClient: Minio.Client;

export async function initMinIO() {
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
}

export async function uploadFile(
  objectName: string,
  buffer: Buffer,
  contentType?: string
): Promise<string> {
  const metaData = contentType ? { 'Content-Type': contentType } : {};
  await minioClient.putObject(config.minio.bucket, objectName, buffer, buffer.length, metaData);
  return objectName;
}

export async function downloadFile(objectName: string): Promise<Buffer> {
  const stream = await minioClient.getObject(config.minio.bucket, objectName);
  return streamToBuffer(stream as Readable);
}

export async function deleteFile(objectName: string): Promise<void> {
  await minioClient.removeObject(config.minio.bucket, objectName);
}

export async function getFileUrl(objectName: string, expiry = 3600): Promise<string> {
  return minioClient.presignedGetObject(config.minio.bucket, objectName, expiry);
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

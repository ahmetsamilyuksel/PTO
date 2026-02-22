import * as Minio from 'minio';
import { config } from '../config';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';

// ─── Storage Type Detection ───
const storageType = config.storage.type;

// ─── MinIO Client (only if using minio) ───
let minioClient: Minio.Client | null = null;
let storageReady = false;

// ─── Local Storage Base Path ───
const localBasePath = config.storage.localPath;

// ─── Init ───
export async function initStorage() {
  if (storageType === 'local') {
    try {
      await fsPromises.mkdir(localBasePath, { recursive: true });
      storageReady = true;
      console.log(`[storage] Local filesystem storage ready at: ${localBasePath}`);
    } catch (err) {
      console.error('[storage] Failed to initialize local storage:', err instanceof Error ? err.message : String(err));
      storageReady = false;
    }
  } else {
    // MinIO / S3
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
        console.log(`[storage] Bucket ${config.minio.bucket} created`);
      }
      storageReady = true;
      console.log(`[storage] MinIO storage ready (${config.minio.endpoint}:${config.minio.port})`);
    } catch (err) {
      console.warn('[storage] MinIO not available, file operations will be disabled:', err instanceof Error ? err.message : String(err));
      storageReady = false;
    }
  }
}

// Backward compat alias
export const initMinIO = initStorage;

function ensureStorage() {
  if (!storageReady) {
    throw new Error('File storage is not configured. Set STORAGE_TYPE=local or configure MinIO.');
  }
}

function ensureMinIO(): Minio.Client {
  if (!minioClient || !storageReady) {
    throw new Error('MinIO storage is not configured.');
  }
  return minioClient;
}

export function isStorageReady(): boolean {
  return storageReady;
}

// ─── Upload ───
export async function uploadFile(
  objectName: string,
  buffer: Buffer,
  contentType?: string
): Promise<string> {
  ensureStorage();

  if (storageType === 'local') {
    const fullPath = path.join(localBasePath, objectName);
    await fsPromises.mkdir(path.dirname(fullPath), { recursive: true });
    await fsPromises.writeFile(fullPath, buffer);
    return objectName;
  } else {
    const client = ensureMinIO();
    const metaData = contentType ? { 'Content-Type': contentType } : {};
    await client.putObject(config.minio.bucket, objectName, buffer, buffer.length, metaData);
    return objectName;
  }
}

// ─── Download ───
export async function downloadFile(objectName: string): Promise<Buffer> {
  ensureStorage();

  if (storageType === 'local') {
    const fullPath = path.join(localBasePath, objectName);
    return fsPromises.readFile(fullPath);
  } else {
    const client = ensureMinIO();
    const stream = await client.getObject(config.minio.bucket, objectName);
    return streamToBuffer(stream as Readable);
  }
}

// ─── Delete ───
export async function deleteFile(objectName: string): Promise<void> {
  ensureStorage();

  if (storageType === 'local') {
    const fullPath = path.join(localBasePath, objectName);
    try {
      await fsPromises.unlink(fullPath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }
  } else {
    const client = ensureMinIO();
    await client.removeObject(config.minio.bucket, objectName);
  }
}

// ─── Get File URL ───
export async function getFileUrl(objectName: string, expiry = 3600): Promise<string> {
  ensureStorage();

  if (storageType === 'local') {
    // For local storage, return a relative URL that the backend will serve
    const baseUrl = process.env.BACKEND_URL || `http://localhost:${config.port}`;
    return `${baseUrl}/api/files/${objectName}`;
  } else {
    const client = ensureMinIO();
    return client.presignedGetObject(config.minio.bucket, objectName, expiry);
  }
}

// ─── Helpers ───
function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export { minioClient };

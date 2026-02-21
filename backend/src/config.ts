export const config = {
  port: parseInt(process.env.BACKEND_PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: '24h',
  database: {
    url: process.env.DATABASE_URL || 'postgresql://pto:pto_secret@localhost:5432/pto_db?schema=public',
  },
  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucket: process.env.MINIO_BUCKET || 'pto-files',
    useSSL: false,
  },
  upload: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/zip',
      'application/dwg',
      'application/dxf',
    ],
  },
  systemName: 'ПТО DocOps',
};

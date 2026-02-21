import { Router, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';
import { uploadFile, downloadFile, deleteFile, getFileUrl } from '../services/storage';
import { config } from '../config';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter: (_req, file, cb) => {
    if (config.upload.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Недопустимый тип файла: ${file.mimetype}`));
    }
  },
});

// ─── GET /api/attachments ───
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { documentId, journalEntryId, testProtocolId, incomingControlId, category } = req.query;

    const where: any = {};
    if (documentId) where.documentId = documentId as string;
    if (journalEntryId) where.journalEntryId = journalEntryId as string;
    if (testProtocolId) where.testProtocolId = testProtocolId as string;
    if (incomingControlId) where.incomingControlId = incomingControlId as string;
    if (category) where.category = category as string;

    // Require at least one filter
    if (Object.keys(where).length === 0) {
      return res.status(400).json({
        error: 'Укажите хотя бы один фильтр: documentId, journalEntryId, testProtocolId, incomingControlId',
      });
    }

    const attachments = await prisma.attachment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ data: attachments });
  } catch (error) {
    console.error('List attachments error:', error);
    return res.status(500).json({ error: 'Ошибка при получении списка вложений' });
  }
});

// ─── GET /api/attachments/:id ───
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const attachment = await prisma.attachment.findUnique({
      where: { id: req.params.id },
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Вложение не найдено' });
    }

    return res.json(attachment);
  } catch (error) {
    console.error('Get attachment error:', error);
    return res.status(500).json({ error: 'Ошибка при получении вложения' });
  }
});

// ─── GET /api/attachments/:id/url ───
router.get('/:id/url', async (req: AuthRequest, res: Response) => {
  try {
    const attachment = await prisma.attachment.findUnique({
      where: { id: req.params.id },
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Вложение не найдено' });
    }

    const expiry = parseInt(req.query.expiry as string) || 3600;
    const url = await getFileUrl(attachment.filePath, expiry);

    return res.json({ url, expiresIn: expiry });
  } catch (error) {
    console.error('Get attachment URL error:', error);
    return res.status(500).json({ error: 'Ошибка при получении ссылки на файл' });
  }
});

// ─── GET /api/attachments/:id/download ───
router.get('/:id/download', async (req: AuthRequest, res: Response) => {
  try {
    const attachment = await prisma.attachment.findUnique({
      where: { id: req.params.id },
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Вложение не найдено' });
    }

    const buffer = await downloadFile(attachment.filePath);

    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.originalName)}"`);
    res.setHeader('Content-Length', buffer.length);

    return res.send(buffer);
  } catch (error) {
    console.error('Download attachment error:', error);
    return res.status(500).json({ error: 'Ошибка при скачивании файла' });
  }
});

// ─── POST /api/attachments/upload ───
router.post('/upload', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Файл не предоставлен' });
    }

    const { documentId, journalEntryId, testProtocolId, incomingControlId, category, description } = req.body;

    // Validate at least one parent reference
    if (!documentId && !journalEntryId && !testProtocolId && !incomingControlId) {
      return res.status(400).json({
        error: 'Укажите привязку: documentId, journalEntryId, testProtocolId или incomingControlId',
      });
    }

    // Validate parent exists
    if (documentId) {
      const doc = await prisma.document.findUnique({ where: { id: documentId } });
      if (!doc || doc.deletedAt) {
        return res.status(404).json({ error: 'Документ не найден' });
      }
    }
    if (journalEntryId) {
      const entry = await prisma.journalEntry.findUnique({ where: { id: journalEntryId } });
      if (!entry) {
        return res.status(404).json({ error: 'Запись журнала не найдена' });
      }
    }
    if (testProtocolId) {
      const protocol = await prisma.testProtocol.findUnique({ where: { id: testProtocolId } });
      if (!protocol) {
        return res.status(404).json({ error: 'Протокол испытаний не найден' });
      }
    }
    if (incomingControlId) {
      const control = await prisma.incomingControl.findUnique({ where: { id: incomingControlId } });
      if (!control) {
        return res.status(404).json({ error: 'Запись входного контроля не найдена' });
      }
    }

    // Generate unique file name and path
    const fileId = uuidv4();
    const ext = path.extname(file.originalname);
    const storedName = `${fileId}${ext}`;

    // Build storage path based on parent type
    let folderPath = 'attachments/';
    if (documentId) folderPath += `documents/${documentId}/`;
    else if (journalEntryId) folderPath += `journal-entries/${journalEntryId}/`;
    else if (testProtocolId) folderPath += `test-protocols/${testProtocolId}/`;
    else if (incomingControlId) folderPath += `incoming-controls/${incomingControlId}/`;

    const filePath = `${folderPath}${storedName}`;

    // Upload to MinIO
    await uploadFile(filePath, file.buffer, file.mimetype);

    // Create attachment record
    const attachment = await prisma.attachment.create({
      data: {
        fileName: storedName,
        originalName: file.originalname,
        filePath,
        mimeType: file.mimetype,
        fileSize: file.size,
        description: description || null,
        category: category || 'OTHER',
        documentId: documentId || null,
        journalEntryId: journalEntryId || null,
        testProtocolId: testProtocolId || null,
        incomingControlId: incomingControlId || null,
      },
    });

    return res.status(201).json(attachment);
  } catch (error: any) {
    if (error.message?.includes('Недопустимый тип файла')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Upload attachment error:', error);
    return res.status(500).json({ error: 'Ошибка при загрузке файла' });
  }
});

// ─── POST /api/attachments/upload-multiple ───
router.post('/upload-multiple', upload.array('files', 10), async (req: AuthRequest, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Файлы не предоставлены' });
    }

    const { documentId, journalEntryId, testProtocolId, incomingControlId, category } = req.body;

    if (!documentId && !journalEntryId && !testProtocolId && !incomingControlId) {
      return res.status(400).json({
        error: 'Укажите привязку: documentId, journalEntryId, testProtocolId или incomingControlId',
      });
    }

    let folderPath = 'attachments/';
    if (documentId) folderPath += `documents/${documentId}/`;
    else if (journalEntryId) folderPath += `journal-entries/${journalEntryId}/`;
    else if (testProtocolId) folderPath += `test-protocols/${testProtocolId}/`;
    else if (incomingControlId) folderPath += `incoming-controls/${incomingControlId}/`;

    const attachments = [];

    for (const file of files) {
      const fileId = uuidv4();
      const ext = path.extname(file.originalname);
      const storedName = `${fileId}${ext}`;
      const filePath = `${folderPath}${storedName}`;

      await uploadFile(filePath, file.buffer, file.mimetype);

      const attachment = await prisma.attachment.create({
        data: {
          fileName: storedName,
          originalName: file.originalname,
          filePath,
          mimeType: file.mimetype,
          fileSize: file.size,
          category: category || 'OTHER',
          documentId: documentId || null,
          journalEntryId: journalEntryId || null,
          testProtocolId: testProtocolId || null,
          incomingControlId: incomingControlId || null,
        },
      });

      attachments.push(attachment);
    }

    return res.status(201).json({ data: attachments, count: attachments.length });
  } catch (error) {
    console.error('Upload multiple attachments error:', error);
    return res.status(500).json({ error: 'Ошибка при загрузке файлов' });
  }
});

// ─── PUT /api/attachments/:id ───
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.attachment.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Вложение не найдено' });
    }

    const { description, category } = req.body;

    const attachment = await prisma.attachment.update({
      where: { id: req.params.id },
      data: {
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
      },
    });

    return res.json(attachment);
  } catch (error) {
    console.error('Update attachment error:', error);
    return res.status(500).json({ error: 'Ошибка при обновлении вложения' });
  }
});

// ─── DELETE /api/attachments/:id ───
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.attachment.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Вложение не найдено' });
    }

    // Check if parent document is locked
    if (existing.documentId) {
      const doc = await prisma.document.findUnique({ where: { id: existing.documentId } });
      if (doc?.lockedAt) {
        return res.status(400).json({ error: 'Нельзя удалить вложение подписанного документа' });
      }
    }

    // Delete from storage
    try {
      await deleteFile(existing.filePath);
    } catch (storageError) {
      console.error('Storage delete error (proceeding with DB delete):', storageError);
    }

    // Delete from database
    await prisma.attachment.delete({ where: { id: req.params.id } });

    return res.json({ message: 'Вложение удалено' });
  } catch (error) {
    console.error('Delete attachment error:', error);
    return res.status(500).json({ error: 'Ошибка при удалении вложения' });
  }
});

export default router;

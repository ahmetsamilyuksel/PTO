import { Router, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/auth';

const router = Router();

// ─── GET /api/packages?projectId=... ───
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, status, page = '1', limit = '20' } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'Обязательный параметр: projectId' });
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = { projectId: projectId as string };
    if (status) where.status = status as string;

    const [packages, total] = await Promise.all([
      prisma.package.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { items: true } },
        },
      }),
      prisma.package.count({ where }),
    ]);

    return res.json({ data: packages, total, page: parseInt(page as string), limit: take });
  } catch (error) {
    console.error('List packages error:', error);
    return res.status(500).json({ error: 'Ошибка при получении списка комплектов ИД' });
  }
});

// ─── GET /api/packages/:id ───
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const pkg = await prisma.package.findUnique({
      where: { id: req.params.id },
      include: {
        project: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            document: {
              select: {
                id: true,
                title: true,
                documentNumber: true,
                documentType: true,
                status: true,
                revision: true,
                documentDate: true,
                fileName: true,
              },
            },
          },
          orderBy: [{ folderPath: 'asc' }, { sortOrder: 'asc' }],
        },
      },
    });

    if (!pkg) {
      return res.status(404).json({ error: 'Комплект ИД не найден' });
    }

    return res.json(pkg);
  } catch (error) {
    console.error('Get package error:', error);
    return res.status(500).json({ error: 'Ошибка при получении комплекта ИД' });
  }
});

// ─── POST /api/packages ───
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, name, description, periodFrom, periodTo } = req.body;

    if (!projectId || !name) {
      return res.status(400).json({ error: 'Обязательные поля: projectId, name' });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.deletedAt) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    const pkg = await prisma.package.create({
      data: {
        projectId,
        name,
        description: description || null,
        periodFrom: periodFrom ? new Date(periodFrom) : null,
        periodTo: periodTo ? new Date(periodTo) : null,
        status: 'DRAFT',
      },
    });

    return res.status(201).json(pkg);
  } catch (error) {
    console.error('Create package error:', error);
    return res.status(500).json({ error: 'Ошибка при создании комплекта ИД' });
  }
});

// ─── PUT /api/packages/:id ───
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.package.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Комплект ИД не найден' });
    }

    if (['GENERATING', 'DELIVERED'].includes(existing.status)) {
      return res.status(400).json({ error: 'Нельзя редактировать комплект в текущем статусе' });
    }

    const { name, description, periodFrom, periodTo } = req.body;

    const pkg = await prisma.package.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(periodFrom !== undefined && { periodFrom: periodFrom ? new Date(periodFrom) : null }),
        ...(periodTo !== undefined && { periodTo: periodTo ? new Date(periodTo) : null }),
      },
    });

    return res.json(pkg);
  } catch (error) {
    console.error('Update package error:', error);
    return res.status(500).json({ error: 'Ошибка при обновлении комплекта ИД' });
  }
});

// ─── DELETE /api/packages/:id ───
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.package.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Комплект ИД не найден' });
    }

    if (existing.status === 'DELIVERED') {
      return res.status(400).json({ error: 'Нельзя удалить переданный комплект ИД' });
    }

    // Delete items first
    await prisma.packageItem.deleteMany({ where: { packageId: req.params.id } });
    await prisma.package.delete({ where: { id: req.params.id } });

    return res.json({ message: 'Комплект ИД удалён' });
  } catch (error) {
    console.error('Delete package error:', error);
    return res.status(500).json({ error: 'Ошибка при удалении комплекта ИД' });
  }
});

// ═══════════════════════════════════════════════
// PACKAGE ITEMS
// ═══════════════════════════════════════════════

// ─── POST /api/packages/:id/items ───
router.post('/:id/items', async (req: AuthRequest, res: Response) => {
  try {
    const pkg = await prisma.package.findUnique({ where: { id: req.params.id } });
    if (!pkg) {
      return res.status(404).json({ error: 'Комплект ИД не найден' });
    }

    if (!['DRAFT', 'READY'].includes(pkg.status)) {
      return res.status(400).json({ error: 'Можно добавлять документы только в черновик или готовый комплект' });
    }

    const { documentId, folderPath, sortOrder } = req.body;

    if (!documentId || !folderPath) {
      return res.status(400).json({ error: 'Обязательные поля: documentId, folderPath' });
    }

    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document || document.deletedAt) {
      return res.status(404).json({ error: 'Документ не найден' });
    }

    if (document.projectId !== pkg.projectId) {
      return res.status(400).json({ error: 'Документ принадлежит другому проекту' });
    }

    const item = await prisma.packageItem.create({
      data: {
        packageId: req.params.id,
        documentId,
        folderPath,
        sortOrder: sortOrder || 0,
      },
      include: {
        document: {
          select: { id: true, title: true, documentNumber: true, documentType: true, status: true },
        },
      },
    });

    // Update package status back to draft if it was ready
    if (pkg.status === 'READY') {
      await prisma.package.update({
        where: { id: req.params.id },
        data: { status: 'DRAFT' },
      });
    }

    return res.status(201).json(item);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Документ уже добавлен в данный комплект' });
    }
    console.error('Add package item error:', error);
    return res.status(500).json({ error: 'Ошибка при добавлении документа в комплект' });
  }
});

// ─── POST /api/packages/:id/items/bulk ───
router.post('/:id/items/bulk', async (req: AuthRequest, res: Response) => {
  try {
    const pkg = await prisma.package.findUnique({ where: { id: req.params.id } });
    if (!pkg) {
      return res.status(404).json({ error: 'Комплект ИД не найден' });
    }

    if (!['DRAFT', 'READY'].includes(pkg.status)) {
      return res.status(400).json({ error: 'Можно добавлять документы только в черновик или готовый комплект' });
    }

    const { items } = req.body; // [{ documentId, folderPath, sortOrder }]
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Обязательное поле: items (массив)' });
    }

    const results: any[] = [];
    const errors: string[] = [];

    for (const item of items) {
      try {
        if (!item.documentId || !item.folderPath) {
          errors.push(`Пропущен элемент без documentId или folderPath`);
          continue;
        }

        const created = await prisma.packageItem.create({
          data: {
            packageId: req.params.id,
            documentId: item.documentId,
            folderPath: item.folderPath,
            sortOrder: item.sortOrder || 0,
          },
        });
        results.push(created);
      } catch (err: any) {
        if (err?.code === 'P2002') {
          errors.push(`Документ ${item.documentId} уже в комплекте`);
        } else {
          errors.push(`Ошибка для документа ${item.documentId}`);
        }
      }
    }

    // Reset status to draft
    if (pkg.status === 'READY' && results.length > 0) {
      await prisma.package.update({
        where: { id: req.params.id },
        data: { status: 'DRAFT' },
      });
    }

    return res.status(201).json({
      added: results.length,
      errors,
      items: results,
    });
  } catch (error) {
    console.error('Bulk add package items error:', error);
    return res.status(500).json({ error: 'Ошибка при массовом добавлении документов в комплект' });
  }
});

// ─── DELETE /api/packages/:packageId/items/:itemId ───
router.delete('/:packageId/items/:itemId', async (req: AuthRequest, res: Response) => {
  try {
    const item = await prisma.packageItem.findUnique({ where: { id: req.params.itemId } });
    if (!item || item.packageId !== req.params.packageId) {
      return res.status(404).json({ error: 'Элемент комплекта не найден' });
    }

    await prisma.packageItem.delete({ where: { id: req.params.itemId } });

    return res.json({ message: 'Документ удалён из комплекта' });
  } catch (error) {
    console.error('Remove package item error:', error);
    return res.status(500).json({ error: 'Ошибка при удалении документа из комплекта' });
  }
});

// ═══════════════════════════════════════════════
// PACKAGE GENERATION (ZIP)
// ═══════════════════════════════════════════════

// ─── POST /api/packages/:id/generate ───
router.post('/:id/generate', async (req: AuthRequest, res: Response) => {
  try {
    const pkg = await prisma.package.findUnique({
      where: { id: req.params.id },
      include: {
        project: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            document: {
              select: {
                id: true,
                title: true,
                documentNumber: true,
                documentType: true,
                status: true,
                filePath: true,
                fileName: true,
                revision: true,
              },
            },
          },
          orderBy: [{ folderPath: 'asc' }, { sortOrder: 'asc' }],
        },
      },
    });

    if (!pkg) {
      return res.status(404).json({ error: 'Комплект ИД не найден' });
    }

    if (pkg.items.length === 0) {
      return res.status(400).json({ error: 'Комплект не содержит документов' });
    }

    // Validate all documents have files
    const missingFiles = pkg.items.filter((item) => !item.document.filePath);
    if (missingFiles.length > 0) {
      return res.status(400).json({
        error: 'Не все документы имеют сгенерированные файлы',
        missingDocuments: missingFiles.map((item) => ({
          documentId: item.document.id,
          title: item.document.title,
        })),
      });
    }

    // Check unsigned documents
    const unsignedDocs = pkg.items.filter((item) => item.document.status !== 'SIGNED' && item.document.status !== 'IN_PACKAGE');
    if (unsignedDocs.length > 0) {
      const { allowUnsigned } = req.body;
      if (!allowUnsigned) {
        return res.status(400).json({
          error: 'Не все документы подписаны. Передайте allowUnsigned: true для продолжения',
          unsignedDocuments: unsignedDocs.map((item) => ({
            documentId: item.document.id,
            title: item.document.title,
            status: item.document.status,
          })),
        });
      }
    }

    // Set status to GENERATING
    await prisma.package.update({
      where: { id: req.params.id },
      data: { status: 'GENERATING' },
    });

    // Build opis (inventory table)
    const opisData = pkg.items.map((item, idx) => ({
      number: idx + 1,
      documentNumber: item.document.documentNumber || '-',
      title: item.document.title,
      documentType: item.document.documentType,
      revision: item.document.revision,
      folder: item.folderPath,
      fileName: item.document.fileName || '-',
    }));

    // In a real system, this would create an actual ZIP file via a background job.
    // For now, we build the package structure and mark as ready.
    const zipPath = `packages/${pkg.projectId}/${pkg.id}/package_${pkg.id}.zip`;
    const opisPath = `packages/${pkg.projectId}/${pkg.id}/opis_${pkg.id}.xlsx`;

    // Mark documents as IN_PACKAGE
    await prisma.$transaction(async (tx) => {
      for (const item of pkg.items) {
        if (item.document.status === 'SIGNED') {
          await tx.document.update({
            where: { id: item.document.id },
            data: { status: 'IN_PACKAGE' },
          });
        }
      }

      await tx.package.update({
        where: { id: req.params.id },
        data: {
          status: 'READY',
          filePath: zipPath,
          opisPath,
        },
      });
    });

    return res.json({
      message: 'Комплект ИД сформирован',
      packageId: pkg.id,
      filePath: zipPath,
      opisPath,
      documentCount: pkg.items.length,
      opis: opisData,
    });
  } catch (error) {
    console.error('Generate package error:', error);
    // Reset status on failure
    await prisma.package.update({
      where: { id: req.params.id },
      data: { status: 'DRAFT' },
    }).catch(() => {});
    return res.status(500).json({ error: 'Ошибка при формировании комплекта ИД' });
  }
});

// ─── PUT /api/packages/:id/deliver ───
router.put('/:id/deliver', requireRole('ADMIN', 'PROJECT_MANAGER', 'ENGINEER'), async (req: AuthRequest, res: Response) => {
  try {
    const pkg = await prisma.package.findUnique({ where: { id: req.params.id } });
    if (!pkg) {
      return res.status(404).json({ error: 'Комплект ИД не найден' });
    }

    if (pkg.status !== 'READY') {
      return res.status(400).json({ error: 'Можно передать только сформированный комплект (статус READY)' });
    }

    const updated = await prisma.package.update({
      where: { id: req.params.id },
      data: { status: 'DELIVERED' },
    });

    return res.json({ message: 'Комплект ИД отмечен как переданный', package: updated });
  } catch (error) {
    console.error('Deliver package error:', error);
    return res.status(500).json({ error: 'Ошибка при передаче комплекта ИД' });
  }
});

export default router;

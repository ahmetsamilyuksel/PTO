import { Router, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// ─── GET /api/journals?projectId=... ───
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, journalType, status } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'Обязательный параметр: projectId' });
    }

    const where: any = { projectId: projectId as string, deletedAt: null };
    if (journalType) where.journalType = journalType as string;
    if (status) where.status = status as string;

    const journals = await prisma.journal.findMany({
      where,
      orderBy: [{ journalType: 'asc' }, { title: 'asc' }],
      include: {
        _count: { select: { entries: true } },
      },
    });

    return res.json({ data: journals });
  } catch (error) {
    console.error('List journals error:', error);
    return res.status(500).json({ error: 'Ошибка при получении списка журналов' });
  }
});

// ─── GET /api/journals/:id ───
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const journal = await prisma.journal.findUnique({
      where: { id: req.params.id },
      include: {
        project: { select: { id: true, name: true, code: true } },
        _count: { select: { entries: true } },
      },
    });

    if (!journal || journal.deletedAt) {
      return res.status(404).json({ error: 'Журнал не найден' });
    }

    return res.json(journal);
  } catch (error) {
    console.error('Get journal error:', error);
    return res.status(500).json({ error: 'Ошибка при получении журнала' });
  }
});

// ─── POST /api/journals ───
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, journalType, title, startDate } = req.body;

    if (!projectId || !journalType || !title) {
      return res.status(400).json({ error: 'Обязательные поля: projectId, journalType, title' });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.deletedAt) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    // Check for duplicate journal type in project
    const existing = await prisma.journal.findFirst({
      where: { projectId, journalType, deletedAt: null },
    });
    if (existing) {
      return res.status(409).json({ error: `Журнал типа "${journalType}" уже существует в проекте` });
    }

    const journal = await prisma.journal.create({
      data: {
        projectId,
        journalType,
        title,
        startDate: startDate ? new Date(startDate) : new Date(),
        status: 'ACTIVE',
      },
    });

    return res.status(201).json(journal);
  } catch (error) {
    console.error('Create journal error:', error);
    return res.status(500).json({ error: 'Ошибка при создании журнала' });
  }
});

// ─── PUT /api/journals/:id ───
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.journal.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: 'Журнал не найден' });
    }

    const { title, startDate, endDate, status } = req.body;

    if (status === 'CLOSED' && !endDate) {
      return res.status(400).json({ error: 'При закрытии журнала необходимо указать дату окончания (endDate)' });
    }

    const journal = await prisma.journal.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: new Date(endDate) }),
        ...(status !== undefined && { status }),
      },
    });

    return res.json(journal);
  } catch (error) {
    console.error('Update journal error:', error);
    return res.status(500).json({ error: 'Ошибка при обновлении журнала' });
  }
});

// ─── DELETE /api/journals/:id ───
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.journal.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { entries: true } } },
    });

    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: 'Журнал не найден' });
    }

    if (existing._count.entries > 0) {
      return res.status(400).json({ error: 'Нельзя удалить журнал с записями. Закройте журнал вместо удаления.' });
    }

    await prisma.journal.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    return res.json({ message: 'Журнал удалён' });
  } catch (error) {
    console.error('Delete journal error:', error);
    return res.status(500).json({ error: 'Ошибка при удалении журнала' });
  }
});

// ═══════════════════════════════════════════════
// JOURNAL ENTRIES
// ═══════════════════════════════════════════════

// ─── GET /api/journals/:id/entries ───
router.get('/:id/entries', async (req: AuthRequest, res: Response) => {
  try {
    const { dateFrom, dateTo, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const journal = await prisma.journal.findUnique({ where: { id: req.params.id } });
    if (!journal || journal.deletedAt) {
      return res.status(404).json({ error: 'Журнал не найден' });
    }

    const where: any = { journalId: req.params.id };
    if (dateFrom || dateTo) {
      where.entryDate = {};
      if (dateFrom) where.entryDate.gte = new Date(dateFrom as string);
      if (dateTo) where.entryDate.lte = new Date(dateTo as string);
    }

    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        skip,
        take,
        orderBy: [{ entryDate: 'desc' }, { entryNumber: 'desc' }],
        include: {
          author: { select: { id: true, fio: true, position: true } },
          location: { select: { id: true, name: true } },
          workItem: { select: { id: true, code: true, name: true } },
          documentLinks: {
            include: {
              document: { select: { id: true, title: true, documentNumber: true, documentType: true } },
            },
          },
          attachments: true,
        },
      }),
      prisma.journalEntry.count({ where }),
    ]);

    return res.json({ data: entries, total, page: parseInt(page as string), limit: take });
  } catch (error) {
    console.error('List journal entries error:', error);
    return res.status(500).json({ error: 'Ошибка при получении записей журнала' });
  }
});

// ─── GET /api/journals/:journalId/entries/:entryId ───
router.get('/:journalId/entries/:entryId', async (req: AuthRequest, res: Response) => {
  try {
    const entry = await prisma.journalEntry.findUnique({
      where: { id: req.params.entryId },
      include: {
        journal: { select: { id: true, title: true, journalType: true } },
        author: { select: { id: true, fio: true, position: true } },
        location: { select: { id: true, name: true, locationType: true } },
        workItem: { select: { id: true, code: true, name: true, workType: true } },
        documentLinks: {
          include: {
            document: { select: { id: true, title: true, documentNumber: true, documentType: true, status: true } },
          },
        },
        attachments: true,
      },
    });

    if (!entry || entry.journalId !== req.params.journalId) {
      return res.status(404).json({ error: 'Запись журнала не найдена' });
    }

    return res.json(entry);
  } catch (error) {
    console.error('Get journal entry error:', error);
    return res.status(500).json({ error: 'Ошибка при получении записи журнала' });
  }
});

// ─── POST /api/journals/:id/entries ───
router.post('/:id/entries', async (req: AuthRequest, res: Response) => {
  try {
    const journal = await prisma.journal.findUnique({ where: { id: req.params.id } });
    if (!journal || journal.deletedAt) {
      return res.status(404).json({ error: 'Журнал не найден' });
    }

    if (journal.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Нельзя добавить запись в закрытый или архивный журнал' });
    }

    const {
      entryDate, weatherConditions, temperature,
      crewInfo, workDescription, materialsUsed,
      controlActions, notes, locationId, workItemId,
      documentIds, // Array of document IDs to link
    } = req.body;

    if (!entryDate || !workDescription) {
      return res.status(400).json({ error: 'Обязательные поля: entryDate, workDescription' });
    }

    // Auto-increment entry number
    const lastEntry = await prisma.journalEntry.findFirst({
      where: { journalId: req.params.id },
      orderBy: { entryNumber: 'desc' },
    });
    const entryNumber = (lastEntry?.entryNumber || 0) + 1;

    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.journalEntry.create({
        data: {
          journalId: req.params.id,
          entryNumber,
          entryDate: new Date(entryDate),
          weatherConditions: weatherConditions || null,
          temperature: temperature || null,
          crewInfo: crewInfo || null,
          workDescription,
          materialsUsed: materialsUsed || null,
          controlActions: controlActions || null,
          notes: notes || null,
          authorId: req.userId!,
          locationId: locationId || null,
          workItemId: workItemId || null,
        },
      });

      // Link documents
      if (Array.isArray(documentIds) && documentIds.length > 0) {
        for (const docId of documentIds) {
          await tx.journalEntryDocLink.create({
            data: {
              journalEntryId: created.id,
              documentId: docId,
            },
          });
        }
      }

      return created;
    });

    const full = await prisma.journalEntry.findUnique({
      where: { id: entry.id },
      include: {
        author: { select: { id: true, fio: true, position: true } },
        location: { select: { id: true, name: true } },
        workItem: { select: { id: true, code: true, name: true } },
        documentLinks: {
          include: {
            document: { select: { id: true, title: true, documentNumber: true } },
          },
        },
      },
    });

    return res.status(201).json(full);
  } catch (error) {
    console.error('Create journal entry error:', error);
    return res.status(500).json({ error: 'Ошибка при создании записи журнала' });
  }
});

// ─── PUT /api/journals/:journalId/entries/:entryId ───
router.put('/:journalId/entries/:entryId', async (req: AuthRequest, res: Response) => {
  try {
    const entry = await prisma.journalEntry.findUnique({ where: { id: req.params.entryId } });
    if (!entry || entry.journalId !== req.params.journalId) {
      return res.status(404).json({ error: 'Запись журнала не найдена' });
    }

    const {
      entryDate, weatherConditions, temperature,
      crewInfo, workDescription, materialsUsed,
      controlActions, notes, locationId, workItemId,
    } = req.body;

    const updated = await prisma.journalEntry.update({
      where: { id: req.params.entryId },
      data: {
        ...(entryDate !== undefined && { entryDate: new Date(entryDate) }),
        ...(weatherConditions !== undefined && { weatherConditions }),
        ...(temperature !== undefined && { temperature }),
        ...(crewInfo !== undefined && { crewInfo }),
        ...(workDescription !== undefined && { workDescription }),
        ...(materialsUsed !== undefined && { materialsUsed }),
        ...(controlActions !== undefined && { controlActions }),
        ...(notes !== undefined && { notes }),
        ...(locationId !== undefined && { locationId }),
        ...(workItemId !== undefined && { workItemId }),
      },
      include: {
        author: { select: { id: true, fio: true, position: true } },
        location: { select: { id: true, name: true } },
        workItem: { select: { id: true, code: true, name: true } },
      },
    });

    return res.json(updated);
  } catch (error) {
    console.error('Update journal entry error:', error);
    return res.status(500).json({ error: 'Ошибка при обновлении записи журнала' });
  }
});

// ─── DELETE /api/journals/:journalId/entries/:entryId ───
router.delete('/:journalId/entries/:entryId', async (req: AuthRequest, res: Response) => {
  try {
    const entry = await prisma.journalEntry.findUnique({ where: { id: req.params.entryId } });
    if (!entry || entry.journalId !== req.params.journalId) {
      return res.status(404).json({ error: 'Запись журнала не найдена' });
    }

    // Delete linked documents first
    await prisma.journalEntryDocLink.deleteMany({ where: { journalEntryId: req.params.entryId } });

    await prisma.journalEntry.delete({ where: { id: req.params.entryId } });

    return res.json({ message: 'Запись журнала удалена' });
  } catch (error) {
    console.error('Delete journal entry error:', error);
    return res.status(500).json({ error: 'Ошибка при удалении записи журнала' });
  }
});

// ─── POST /api/journals/:journalId/entries/:entryId/link-document ───
router.post('/:journalId/entries/:entryId/link-document', async (req: AuthRequest, res: Response) => {
  try {
    const entry = await prisma.journalEntry.findUnique({ where: { id: req.params.entryId } });
    if (!entry || entry.journalId !== req.params.journalId) {
      return res.status(404).json({ error: 'Запись журнала не найдена' });
    }

    const { documentId } = req.body;
    if (!documentId) {
      return res.status(400).json({ error: 'Обязательное поле: documentId' });
    }

    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document || document.deletedAt) {
      return res.status(404).json({ error: 'Документ не найден' });
    }

    const link = await prisma.journalEntryDocLink.create({
      data: {
        journalEntryId: req.params.entryId,
        documentId,
      },
      include: {
        document: { select: { id: true, title: true, documentNumber: true, documentType: true } },
      },
    });

    return res.status(201).json(link);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Документ уже привязан к этой записи журнала' });
    }
    console.error('Link document error:', error);
    return res.status(500).json({ error: 'Ошибка при привязке документа к записи журнала' });
  }
});

// ─── DELETE /api/journals/:journalId/entries/:entryId/link-document/:linkId ───
router.delete('/:journalId/entries/:entryId/link-document/:linkId', async (req: AuthRequest, res: Response) => {
  try {
    const link = await prisma.journalEntryDocLink.findUnique({ where: { id: req.params.linkId } });
    if (!link || link.journalEntryId !== req.params.entryId) {
      return res.status(404).json({ error: 'Связь с документом не найдена' });
    }

    await prisma.journalEntryDocLink.delete({ where: { id: req.params.linkId } });

    return res.json({ message: 'Связь с документом удалена' });
  } catch (error) {
    console.error('Unlink document error:', error);
    return res.status(500).json({ error: 'Ошибка при отвязке документа от записи журнала' });
  }
});

export default router;

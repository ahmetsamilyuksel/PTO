import { Router, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// ─── GET /api/journals?projectId=... ───
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, journalType, status } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'Required parameter: projectId' });
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
    return res.status(500).json({ error: 'Error fetching journals list' });
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
      return res.status(404).json({ error: 'Journal not found' });
    }

    return res.json(journal);
  } catch (error) {
    console.error('Get journal error:', error);
    return res.status(500).json({ error: 'Error fetching journal' });
  }
});

// ─── POST /api/journals ───
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, journalType, title, startDate } = req.body;

    if (!projectId || !journalType || !title) {
      return res.status(400).json({ error: 'Required fields: projectId, journalType, title' });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.deletedAt) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check for duplicate journal type in project
    const existing = await prisma.journal.findFirst({
      where: { projectId, journalType, deletedAt: null },
    });
    if (existing) {
      return res.status(409).json({ error: `Journal of type "${journalType}" already exists in the project` });
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
    return res.status(500).json({ error: 'Error creating journal' });
  }
});

// ─── PUT /api/journals/:id ───
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.journal.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: 'Journal not found' });
    }

    const { title, startDate, endDate, status } = req.body;

    if (status === 'CLOSED' && !endDate) {
      return res.status(400).json({ error: 'End date (endDate) is required when closing a journal' });
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
    return res.status(500).json({ error: 'Error updating journal' });
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
      return res.status(404).json({ error: 'Journal not found' });
    }

    if (existing._count.entries > 0) {
      return res.status(400).json({ error: 'Cannot delete a journal that has entries. Close the journal instead.' });
    }

    await prisma.journal.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    return res.json({ message: 'Journal deleted' });
  } catch (error) {
    console.error('Delete journal error:', error);
    return res.status(500).json({ error: 'Error deleting journal' });
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
      return res.status(404).json({ error: 'Journal not found' });
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
    return res.status(500).json({ error: 'Error fetching journal entries' });
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
      return res.status(404).json({ error: 'Journal entry not found' });
    }

    return res.json(entry);
  } catch (error) {
    console.error('Get journal entry error:', error);
    return res.status(500).json({ error: 'Error fetching journal entry' });
  }
});

// ─── POST /api/journals/:id/entries ───
router.post('/:id/entries', async (req: AuthRequest, res: Response) => {
  try {
    const journal = await prisma.journal.findUnique({ where: { id: req.params.id } });
    if (!journal || journal.deletedAt) {
      return res.status(404).json({ error: 'Journal not found' });
    }

    if (journal.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Cannot add entries to a closed or archived journal' });
    }

    const {
      entryDate, weatherConditions, temperature,
      crewInfo, workDescription, materialsUsed,
      controlActions, notes, locationId, workItemId,
      documentIds, // Array of document IDs to link
    } = req.body;

    if (!entryDate || !workDescription) {
      return res.status(400).json({ error: 'Required fields: entryDate, workDescription' });
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
    return res.status(500).json({ error: 'Error creating journal entry' });
  }
});

// ─── PUT /api/journals/:journalId/entries/:entryId ───
router.put('/:journalId/entries/:entryId', async (req: AuthRequest, res: Response) => {
  try {
    const entry = await prisma.journalEntry.findUnique({ where: { id: req.params.entryId } });
    if (!entry || entry.journalId !== req.params.journalId) {
      return res.status(404).json({ error: 'Journal entry not found' });
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
    return res.status(500).json({ error: 'Error updating journal entry' });
  }
});

// ─── DELETE /api/journals/:journalId/entries/:entryId ───
router.delete('/:journalId/entries/:entryId', async (req: AuthRequest, res: Response) => {
  try {
    const entry = await prisma.journalEntry.findUnique({ where: { id: req.params.entryId } });
    if (!entry || entry.journalId !== req.params.journalId) {
      return res.status(404).json({ error: 'Journal entry not found' });
    }

    // Delete linked documents first
    await prisma.journalEntryDocLink.deleteMany({ where: { journalEntryId: req.params.entryId } });

    await prisma.journalEntry.delete({ where: { id: req.params.entryId } });

    return res.json({ message: 'Journal entry deleted' });
  } catch (error) {
    console.error('Delete journal entry error:', error);
    return res.status(500).json({ error: 'Error deleting journal entry' });
  }
});

// ─── POST /api/journals/:journalId/entries/:entryId/link-document ───
router.post('/:journalId/entries/:entryId/link-document', async (req: AuthRequest, res: Response) => {
  try {
    const entry = await prisma.journalEntry.findUnique({ where: { id: req.params.entryId } });
    if (!entry || entry.journalId !== req.params.journalId) {
      return res.status(404).json({ error: 'Journal entry not found' });
    }

    const { documentId } = req.body;
    if (!documentId) {
      return res.status(400).json({ error: 'Required field: documentId' });
    }

    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document || document.deletedAt) {
      return res.status(404).json({ error: 'Document not found' });
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
      return res.status(409).json({ error: 'Document is already linked to this journal entry' });
    }
    console.error('Link document error:', error);
    return res.status(500).json({ error: 'Error linking document to journal entry' });
  }
});

// ─── DELETE /api/journals/:journalId/entries/:entryId/link-document/:linkId ───
router.delete('/:journalId/entries/:entryId/link-document/:linkId', async (req: AuthRequest, res: Response) => {
  try {
    const link = await prisma.journalEntryDocLink.findUnique({ where: { id: req.params.linkId } });
    if (!link || link.journalEntryId !== req.params.entryId) {
      return res.status(404).json({ error: 'Document link not found' });
    }

    await prisma.journalEntryDocLink.delete({ where: { id: req.params.linkId } });

    return res.json({ message: 'Document link deleted' });
  } catch (error) {
    console.error('Unlink document error:', error);
    return res.status(500).json({ error: 'Error unlinking document from journal entry' });
  }
});

export default router;

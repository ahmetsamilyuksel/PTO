import { Router, Request, Response } from 'express';
import { prisma } from '../index';

const router = Router();

// GET /api/corrections?projectId=...&status=...&documentId=...
router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId, status, documentId, severity, assignedToId, page = '1', pageSize = '20' } = req.query;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const where: any = {
      projectId: projectId as string,
    };

    if (status) where.status = status as string;
    if (documentId) where.documentId = documentId as string;
    if (severity) where.severity = severity as string;
    if (assignedToId) where.assignedToId = assignedToId as string;

    const skip = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const take = parseInt(pageSize as string);

    const [corrections, total] = await Promise.all([
      prisma.documentCorrection.findMany({
        where,
        include: {
          document: {
            select: { id: true, title: true, documentNumber: true, documentType: true, status: true },
          },
          assignedTo: { select: { id: true, fio: true, position: true } },
          reportedBy: { select: { id: true, fio: true, position: true } },
          resolvedBy: { select: { id: true, fio: true } },
          _count: { select: { comments: true } },
        },
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
      prisma.documentCorrection.count({ where }),
    ]);

    res.json({ data: corrections, total, page: parseInt(page as string), pageSize: take });
  } catch (error) {
    console.error('Error fetching corrections:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to fetch corrections: ${detail}` });
  }
});

// GET /api/corrections/stats?projectId=...
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const [total, open, inProgress, resolved, byErrorType, bySeverity] = await Promise.all([
      prisma.documentCorrection.count({ where: { projectId: projectId as string } }),
      prisma.documentCorrection.count({ where: { projectId: projectId as string, status: 'OPEN' } }),
      prisma.documentCorrection.count({ where: { projectId: projectId as string, status: 'IN_PROGRESS' } }),
      prisma.documentCorrection.count({ where: { projectId: projectId as string, status: { in: ['RESOLVED', 'VERIFIED', 'CLOSED'] } } }),
      prisma.documentCorrection.groupBy({
        by: ['errorType'],
        where: { projectId: projectId as string },
        _count: true,
      }),
      prisma.documentCorrection.groupBy({
        by: ['severity'],
        where: { projectId: projectId as string },
        _count: true,
      }),
    ]);

    res.json({ total, open, inProgress, resolved, byErrorType, bySeverity });
  } catch (error) {
    console.error('Error fetching correction stats:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to fetch stats: ${detail}` });
  }
});

// GET /api/corrections/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const correction = await prisma.documentCorrection.findUnique({
      where: { id: req.params.id },
      include: {
        document: {
          select: { id: true, title: true, documentNumber: true, documentType: true, status: true },
        },
        assignedTo: { select: { id: true, fio: true, position: true, email: true } },
        reportedBy: { select: { id: true, fio: true, position: true } },
        resolvedBy: { select: { id: true, fio: true } },
        comments: {
          include: {
            author: { select: { id: true, fio: true, position: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!correction) {
      return res.status(404).json({ error: 'Correction not found' });
    }

    res.json(correction);
  } catch (error) {
    console.error('Error fetching correction:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to fetch correction: ${detail}` });
  }
});

// POST /api/corrections
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { projectId, documentId, errorType, description, severity, assignedToId, dueDate } = req.body;

    if (!projectId || !documentId || !errorType || !description) {
      return res.status(400).json({ error: 'projectId, documentId, errorType, and description are required' });
    }

    const correction = await prisma.documentCorrection.create({
      data: {
        projectId,
        documentId,
        errorType,
        description,
        severity: severity || 'MEDIUM',
        assignedToId: assignedToId || null,
        reportedById: userId,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: {
        document: {
          select: { id: true, title: true, documentNumber: true, documentType: true },
        },
        assignedTo: { select: { id: true, fio: true } },
        reportedBy: { select: { id: true, fio: true } },
      },
    });

    res.status(201).json(correction);
  } catch (error) {
    console.error('Error creating correction:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to create correction: ${detail}` });
  }
});

// PUT /api/corrections/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.documentCorrection.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Correction not found' });
    }

    const userId = (req as any).userId;
    const { status, assignedToId, resolution, severity, dueDate } = req.body;

    const updateData: any = {};
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'RESOLVED' || status === 'VERIFIED' || status === 'CLOSED') {
        updateData.resolvedById = userId;
        updateData.resolvedAt = new Date();
      }
    }
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId;
    if (resolution !== undefined) updateData.resolution = resolution;
    if (severity !== undefined) updateData.severity = severity;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

    const correction = await prisma.documentCorrection.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        document: {
          select: { id: true, title: true, documentNumber: true },
        },
        assignedTo: { select: { id: true, fio: true } },
        resolvedBy: { select: { id: true, fio: true } },
      },
    });

    res.json(correction);
  } catch (error) {
    console.error('Error updating correction:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to update correction: ${detail}` });
  }
});

// POST /api/corrections/:id/comments
router.post('/:id/comments', async (req: Request, res: Response) => {
  try {
    const correction = await prisma.documentCorrection.findUnique({ where: { id: req.params.id } });
    if (!correction) {
      return res.status(404).json({ error: 'Correction not found' });
    }

    const userId = (req as any).userId;
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const comment = await prisma.correctionComment.create({
      data: {
        correctionId: req.params.id,
        authorId: userId,
        text,
      },
      include: {
        author: { select: { id: true, fio: true, position: true } },
      },
    });

    res.status(201).json(comment);
  } catch (error) {
    console.error('Error adding comment:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to add comment: ${detail}` });
  }
});

export default router;

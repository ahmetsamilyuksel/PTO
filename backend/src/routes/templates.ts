import { Router, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/auth';

const router = Router();

// ─── GET /api/templates ───
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { documentType, isActive, search } = req.query;

    const where: any = {};
    if (documentType) where.documentType = documentType as string;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const templates = await prisma.documentTemplate.findMany({
      where,
      orderBy: [{ documentType: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { documents: true } },
      },
    });

    return res.json({ data: templates });
  } catch (error) {
    console.error('List templates error:', error);
    return res.status(500).json({ error: 'Error fetching templates list' });
  }
});

// ─── GET /api/templates/:id ───
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const template = await prisma.documentTemplate.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { documents: true } },
      },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    return res.json(template);
  } catch (error) {
    console.error('Get template error:', error);
    return res.status(500).json({ error: 'Error fetching template' });
  }
});

// ─── POST /api/templates ───
router.post('/', requireRole('ADMIN', 'PROJECT_MANAGER', 'ENGINEER'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, documentType, description, filePath, fields } = req.body;

    if (!name || !documentType || !filePath) {
      return res.status(400).json({ error: 'Required fields: name, documentType, filePath' });
    }

    const template = await prisma.documentTemplate.create({
      data: {
        name,
        documentType,
        description: description || null,
        filePath,
        fields: fields || null,
        version: 1,
        isActive: true,
      },
    });

    return res.status(201).json(template);
  } catch (error) {
    console.error('Create template error:', error);
    return res.status(500).json({ error: 'Error creating template' });
  }
});

// ─── PUT /api/templates/:id ───
router.put('/:id', requireRole('ADMIN', 'PROJECT_MANAGER', 'ENGINEER'), async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.documentTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const { name, description, filePath, fields, isActive } = req.body;

    // If file path changed, increment version
    const newVersion = (filePath && filePath !== existing.filePath)
      ? existing.version + 1
      : existing.version;

    const template = await prisma.documentTemplate.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(filePath !== undefined && { filePath }),
        ...(fields !== undefined && { fields }),
        ...(isActive !== undefined && { isActive }),
        version: newVersion,
      },
    });

    return res.json(template);
  } catch (error) {
    console.error('Update template error:', error);
    return res.status(500).json({ error: 'Error updating template' });
  }
});

// ─── DELETE /api/templates/:id ───
router.delete('/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.documentTemplate.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { documents: true } } },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (existing._count.documents > 0) {
      // Soft-disable instead of delete if used by documents
      await prisma.documentTemplate.update({
        where: { id: req.params.id },
        data: { isActive: false },
      });
      return res.json({ message: 'Template deactivated (in use by documents)' });
    }

    await prisma.documentTemplate.delete({ where: { id: req.params.id } });

    return res.json({ message: 'Template deleted' });
  } catch (error) {
    console.error('Delete template error:', error);
    return res.status(500).json({ error: 'Error deleting template' });
  }
});

// ─── POST /api/templates/:id/duplicate ───
router.post('/:id/duplicate', requireRole('ADMIN', 'PROJECT_MANAGER', 'ENGINEER'), async (req: AuthRequest, res: Response) => {
  try {
    const original = await prisma.documentTemplate.findUnique({ where: { id: req.params.id } });
    if (!original) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const { name } = req.body;

    const duplicate = await prisma.documentTemplate.create({
      data: {
        name: name || `${original.name} (copy)`,
        documentType: original.documentType,
        description: original.description,
        filePath: original.filePath,
        fields: original.fields ?? undefined,
        version: 1,
        isActive: true,
      },
    });

    return res.status(201).json(duplicate);
  } catch (error) {
    console.error('Duplicate template error:', error);
    return res.status(500).json({ error: 'Error copying template' });
  }
});

export default router;

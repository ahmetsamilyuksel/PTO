import { Router, Request, Response } from 'express';
import { prisma } from '../index';

const router = Router();

// GET /api/custom-templates?projectId=...
router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId, documentType } = req.query;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const where: any = {
      projectId: projectId as string,
      deletedAt: null,
    };

    if (documentType) {
      where.documentType = documentType as string;
    }

    const templates = await prisma.customTemplate.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, fio: true, position: true },
        },
        _count: {
          select: { documents: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(templates);
  } catch (error) {
    console.error('Error fetching custom templates:', error);
    res.status(500).json({ error: 'Failed to fetch custom templates' });
  }
});

// GET /api/custom-templates/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const template = await prisma.customTemplate.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: {
          select: { id: true, fio: true, position: true },
        },
        documents: {
          where: { deletedAt: null },
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!template || template.deletedAt) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// POST /api/custom-templates
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { projectId, name, description, documentType, categoryId, fields, format } = req.body;

    if (!projectId || !name) {
      return res.status(400).json({ error: 'projectId and name are required' });
    }

    const template = await prisma.customTemplate.create({
      data: {
        projectId,
        name,
        description,
        documentType: documentType || null,
        categoryId: categoryId || null,
        fields: fields || null,
        format: format || 'DOCX',
        createdById: userId,
      },
      include: {
        createdBy: {
          select: { id: true, fio: true },
        },
      },
    });

    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// PUT /api/custom-templates/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, description, documentType, categoryId, fields, format, isActive } = req.body;

    const template = await prisma.customTemplate.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(documentType !== undefined && { documentType }),
        ...(categoryId !== undefined && { categoryId }),
        ...(fields !== undefined && { fields }),
        ...(format !== undefined && { format }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json(template);
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// DELETE /api/custom-templates/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.customTemplate.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    res.json({ message: 'Template deleted' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { prisma } from '../index';

const router = Router();

// GET /api/categories?projectId=...
router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const categories = await prisma.customCategory.findMany({
      where: {
        projectId: projectId as string,
        deletedAt: null,
      },
      include: {
        children: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: { documents: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to fetch categories: ${detail}` });
  }
});

// GET /api/categories/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const category = await prisma.customCategory.findUnique({
      where: { id: req.params.id },
      include: {
        children: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
        documents: {
          where: { deletedAt: null },
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!category || category.deletedAt) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(category);
  } catch (error) {
    console.error('Error fetching category:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to fetch category: ${detail}` });
  }
});

// POST /api/categories
router.post('/', async (req: Request, res: Response) => {
  try {
    const { projectId, name, code, description, parentId, sortOrder } = req.body;

    if (!projectId || !name || !code) {
      return res.status(400).json({ error: 'projectId, name, and code are required' });
    }

    const category = await prisma.customCategory.create({
      data: {
        projectId,
        name,
        code,
        description,
        parentId: parentId || null,
        sortOrder: sortOrder || 0,
      },
    });

    res.status(201).json(category);
  } catch (error: any) {
    if ((error as any)?.code === 'P2002') {
      return res.status(409).json({ error: 'Category code already exists in this project' });
    }
    console.error('Error creating category:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to create category: ${detail}` });
  }
});

// PUT /api/categories/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, code, description, parentId, sortOrder, isActive } = req.body;

    const existing = await prisma.customCategory.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const category = await prisma.customCategory.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(description !== undefined && { description }),
        ...(parentId !== undefined && { parentId }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to update category: ${detail}` });
  }
});

// DELETE /api/categories/:id (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.customCategory.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: 'Category not found' });
    }

    await prisma.customCategory.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    res.json({ message: 'Category deleted' });
  } catch (error) {
    console.error('Error deleting category:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to delete category: ${detail}` });
  }
});

export default router;

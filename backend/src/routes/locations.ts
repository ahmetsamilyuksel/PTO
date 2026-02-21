import { Router, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// ─── GET /api/locations?projectId=... ───
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, parentId, locationType, search, flat } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'Обязательный параметр: projectId' });
    }

    const where: any = { projectId: projectId as string, deletedAt: null };
    if (parentId) where.parentId = parentId as string;
    if (locationType) where.locationType = locationType as string;
    if (search) {
      where.name = { contains: search as string, mode: 'insensitive' };
    }

    // Flat list or tree structure
    if (flat === 'true') {
      const locations = await prisma.location.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          _count: { select: { children: true, workItems: true, documents: true } },
        },
      });
      return res.json({ data: locations });
    }

    // Tree: fetch top-level locations with nested children
    where.parentId = parentId ? (parentId as string) : null;

    const locations = await prisma.location.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        children: {
          where: { deletedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          include: {
            children: {
              where: { deletedAt: null },
              orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
              include: {
                children: {
                  where: { deletedAt: null },
                  orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
                },
              },
            },
          },
        },
        _count: { select: { workItems: true, documents: true } },
      },
    });

    return res.json({ data: locations });
  } catch (error) {
    console.error('List locations error:', error);
    return res.status(500).json({ error: 'Ошибка при получении списка локаций' });
  }
});

// ─── GET /api/locations/:id ───
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const location = await prisma.location.findUnique({
      where: { id: req.params.id },
      include: {
        parent: { select: { id: true, name: true, locationType: true } },
        children: {
          where: { deletedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
        _count: { select: { workItems: true, documents: true, materials: true } },
      },
    });

    if (!location || location.deletedAt) {
      return res.status(404).json({ error: 'Локация не найдена' });
    }

    return res.json(location);
  } catch (error) {
    console.error('Get location error:', error);
    return res.status(500).json({ error: 'Ошибка при получении локации' });
  }
});

// ─── POST /api/locations ───
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, name, locationType, parentId, sortOrder } = req.body;

    if (!projectId || !name || !locationType) {
      return res.status(400).json({ error: 'Обязательные поля: projectId, name, locationType' });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.deletedAt) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    if (parentId) {
      const parent = await prisma.location.findUnique({ where: { id: parentId } });
      if (!parent || parent.deletedAt || parent.projectId !== projectId) {
        return res.status(404).json({ error: 'Родительская локация не найдена' });
      }
    }

    const location = await prisma.location.create({
      data: {
        projectId,
        name,
        locationType,
        parentId: parentId || null,
        sortOrder: sortOrder || 0,
      },
      include: {
        parent: { select: { id: true, name: true, locationType: true } },
      },
    });

    return res.status(201).json(location);
  } catch (error) {
    console.error('Create location error:', error);
    return res.status(500).json({ error: 'Ошибка при создании локации' });
  }
});

// ─── POST /api/locations/bulk ───
router.post('/bulk', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, locations } = req.body;

    if (!projectId || !Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({ error: 'Обязательные поля: projectId, locations (массив)' });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.deletedAt) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    const created = await prisma.$transaction(async (tx) => {
      const nameToId = new Map<string, string>();
      const results = [];

      for (const loc of locations) {
        if (!loc.name || !loc.locationType) continue;

        const parentId = loc.parentName ? nameToId.get(loc.parentName) || null : (loc.parentId || null);

        const location = await tx.location.create({
          data: {
            projectId,
            name: loc.name,
            locationType: loc.locationType,
            parentId,
            sortOrder: loc.sortOrder || 0,
          },
        });

        nameToId.set(loc.name, location.id);
        results.push(location);
      }

      return results;
    });

    return res.status(201).json({ data: created, count: created.length });
  } catch (error) {
    console.error('Bulk create locations error:', error);
    return res.status(500).json({ error: 'Ошибка при массовом создании локаций' });
  }
});

// ─── PUT /api/locations/:id ───
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.location.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: 'Локация не найдена' });
    }

    const { name, locationType, parentId, sortOrder } = req.body;

    // Prevent circular parent reference
    if (parentId === req.params.id) {
      return res.status(400).json({ error: 'Локация не может быть родителем самой себя' });
    }

    const location = await prisma.location.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(locationType !== undefined && { locationType }),
        ...(parentId !== undefined && { parentId }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
      include: {
        parent: { select: { id: true, name: true, locationType: true } },
      },
    });

    return res.json(location);
  } catch (error) {
    console.error('Update location error:', error);
    return res.status(500).json({ error: 'Ошибка при обновлении локации' });
  }
});

// ─── DELETE /api/locations/:id ───
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.location.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { children: true } } },
    });

    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: 'Локация не найдена' });
    }

    if (existing._count.children > 0) {
      return res.status(400).json({ error: 'Нельзя удалить локацию с дочерними элементами' });
    }

    await prisma.location.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    return res.json({ message: 'Локация удалена' });
  } catch (error) {
    console.error('Delete location error:', error);
    return res.status(500).json({ error: 'Ошибка при удалении локации' });
  }
});

export default router;

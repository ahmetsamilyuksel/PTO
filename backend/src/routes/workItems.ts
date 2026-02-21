import { Router, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// ─── GET /api/work-items?projectId=... ───
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      projectId, locationId, parentId, workType, status,
      search, page = '1', limit = '50',
    } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'Обязательный параметр: projectId' });
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = { projectId: projectId as string, deletedAt: null };
    if (locationId) where.locationId = locationId as string;
    if (parentId) where.parentId = parentId as string;
    else if (!req.query.hasOwnProperty('parentId')) where.parentId = null; // top-level by default
    if (workType) where.workType = workType as string;
    if (status) where.status = status as string;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { code: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [workItems, total] = await Promise.all([
      prisma.workItem.findMany({
        where,
        skip,
        take,
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        include: {
          location: { select: { id: true, name: true, locationType: true } },
          children: {
            where: { deletedAt: null },
            orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
            select: { id: true, code: true, name: true, workType: true, status: true },
          },
          _count: { select: { documents: true, materialUsages: true, children: true } },
        },
      }),
      prisma.workItem.count({ where }),
    ]);

    return res.json({ data: workItems, total, page: parseInt(page as string), limit: take });
  } catch (error) {
    console.error('List work items error:', error);
    return res.status(500).json({ error: 'Ошибка при получении списка работ' });
  }
});

// ─── GET /api/work-items/:id ───
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const workItem = await prisma.workItem.findUnique({
      where: { id: req.params.id },
      include: {
        location: { select: { id: true, name: true, locationType: true } },
        parent: { select: { id: true, code: true, name: true } },
        children: {
          where: { deletedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        },
        documents: {
          where: { deletedAt: null },
          select: { id: true, documentType: true, title: true, status: true, documentNumber: true },
          orderBy: { createdAt: 'desc' },
        },
        materialUsages: {
          include: {
            material: { select: { id: true, name: true, brand: true, unit: true } },
          },
        },
        _count: { select: { documents: true, materialUsages: true, testProtocols: true, journalEntries: true } },
      },
    });

    if (!workItem || workItem.deletedAt) {
      return res.status(404).json({ error: 'Работа не найдена' });
    }

    return res.json(workItem);
  } catch (error) {
    console.error('Get work item error:', error);
    return res.status(500).json({ error: 'Ошибка при получении работы' });
  }
});

// ─── POST /api/work-items ───
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      projectId, code, name, workType, locationId, parentId,
      description, unit, quantity, sortOrder,
    } = req.body;

    if (!projectId || !code || !name || !workType) {
      return res.status(400).json({ error: 'Обязательные поля: projectId, code, name, workType' });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.deletedAt) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    if (locationId) {
      const location = await prisma.location.findUnique({ where: { id: locationId } });
      if (!location || location.deletedAt || location.projectId !== projectId) {
        return res.status(404).json({ error: 'Локация не найдена' });
      }
    }

    if (parentId) {
      const parent = await prisma.workItem.findUnique({ where: { id: parentId } });
      if (!parent || parent.deletedAt || parent.projectId !== projectId) {
        return res.status(404).json({ error: 'Родительская работа не найдена' });
      }
    }

    const workItem = await prisma.workItem.create({
      data: {
        projectId,
        code,
        name,
        workType,
        locationId: locationId || null,
        parentId: parentId || null,
        description: description || null,
        unit: unit || null,
        quantity: quantity || null,
        sortOrder: sortOrder || 0,
      },
      include: {
        location: { select: { id: true, name: true, locationType: true } },
      },
    });

    return res.status(201).json(workItem);
  } catch (error) {
    console.error('Create work item error:', error);
    return res.status(500).json({ error: 'Ошибка при создании работы' });
  }
});

// ─── PUT /api/work-items/:id ───
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.workItem.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: 'Работа не найдена' });
    }

    const {
      code, name, workType, locationId, parentId,
      description, unit, quantity, sortOrder, status,
    } = req.body;

    if (parentId === req.params.id) {
      return res.status(400).json({ error: 'Работа не может быть родителем самой себя' });
    }

    const workItem = await prisma.workItem.update({
      where: { id: req.params.id },
      data: {
        ...(code !== undefined && { code }),
        ...(name !== undefined && { name }),
        ...(workType !== undefined && { workType }),
        ...(locationId !== undefined && { locationId }),
        ...(parentId !== undefined && { parentId }),
        ...(description !== undefined && { description }),
        ...(unit !== undefined && { unit }),
        ...(quantity !== undefined && { quantity }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(status !== undefined && { status }),
      },
      include: {
        location: { select: { id: true, name: true, locationType: true } },
      },
    });

    return res.json(workItem);
  } catch (error) {
    console.error('Update work item error:', error);
    return res.status(500).json({ error: 'Ошибка при обновлении работы' });
  }
});

// ─── PUT /api/work-items/:id/status ───
router.put('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Обязательное поле: status' });
    }

    const existing = await prisma.workItem.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: 'Работа не найдена' });
    }

    const validTransitions: Record<string, string[]> = {
      NOT_STARTED: ['IN_PROGRESS'],
      IN_PROGRESS: ['COMPLETED', 'NOT_STARTED'],
      COMPLETED: ['ACCEPTED', 'IN_PROGRESS'],
      ACCEPTED: [],
    };

    if (!validTransitions[existing.status]?.includes(status)) {
      return res.status(400).json({
        error: `Невозможно перейти из статуса "${existing.status}" в "${status}"`,
      });
    }

    const workItem = await prisma.workItem.update({
      where: { id: req.params.id },
      data: { status },
    });

    return res.json(workItem);
  } catch (error) {
    console.error('Update work item status error:', error);
    return res.status(500).json({ error: 'Ошибка при обновлении статуса работы' });
  }
});

// ─── DELETE /api/work-items/:id ───
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.workItem.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { children: true, documents: true } } },
    });

    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: 'Работа не найдена' });
    }

    if (existing._count.children > 0) {
      return res.status(400).json({ error: 'Нельзя удалить работу с дочерними элементами' });
    }

    if (existing._count.documents > 0) {
      return res.status(400).json({ error: 'Нельзя удалить работу с привязанными документами' });
    }

    await prisma.workItem.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    return res.json({ message: 'Работа удалена' });
  } catch (error) {
    console.error('Delete work item error:', error);
    return res.status(500).json({ error: 'Ошибка при удалении работы' });
  }
});

export default router;

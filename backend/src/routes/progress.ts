import { Router, Request, Response } from 'express';
import { prisma } from '../index';

const router = Router();

// GET /api/progress?projectId=...
router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const milestones = await prisma.projectMilestone.findMany({
      where: { projectId: projectId as string },
      orderBy: { sortOrder: 'asc' },
    });

    res.json(milestones);
  } catch (error) {
    console.error('Error fetching milestones:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to fetch milestones: ${detail}` });
  }
});

// GET /api/progress/summary?projectId=...
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const pid = projectId as string;

    const [
      milestones,
      documentCounts,
      workItemCounts,
      taskCounts,
      correctionCounts,
    ] = await Promise.all([
      prisma.projectMilestone.findMany({
        where: { projectId: pid },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.document.groupBy({
        by: ['status'],
        where: { projectId: pid, deletedAt: null },
        _count: true,
      }),
      prisma.workItem.groupBy({
        by: ['status'],
        where: { projectId: pid, deletedAt: null },
        _count: true,
      }),
      prisma.task.groupBy({
        by: ['status'],
        where: { projectId: pid, deletedAt: null },
        _count: true,
      }),
      prisma.documentCorrection.groupBy({
        by: ['status'],
        where: { projectId: pid },
        _count: true,
      }),
    ]);

    const totalMilestones = milestones.length;
    const completedMilestones = milestones.filter(m => m.status === 'COMPLETED').length;
    const overallProgress = totalMilestones > 0
      ? Math.round(milestones.reduce((acc, m) => acc + m.progress, 0) / totalMilestones)
      : 0;

    const docStatusMap: Record<string, number> = {};
    documentCounts.forEach(d => { docStatusMap[d.status] = d._count; });

    const workStatusMap: Record<string, number> = {};
    workItemCounts.forEach(w => { workStatusMap[w.status] = w._count; });

    const taskStatusMap: Record<string, number> = {};
    taskCounts.forEach(t => { taskStatusMap[t.status] = t._count; });

    const corrStatusMap: Record<string, number> = {};
    correctionCounts.forEach(c => { corrStatusMap[c.status] = c._count; });

    res.json({
      milestones,
      overallProgress,
      totalMilestones,
      completedMilestones,
      documents: docStatusMap,
      workItems: workStatusMap,
      tasks: taskStatusMap,
      corrections: corrStatusMap,
    });
  } catch (error) {
    console.error('Error fetching progress summary:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to fetch progress summary: ${detail}` });
  }
});

// POST /api/progress
router.post('/', async (req: Request, res: Response) => {
  try {
    const { projectId, title, description, dueDate, sortOrder } = req.body;

    if (!projectId || !title) {
      return res.status(400).json({ error: 'projectId and title are required' });
    }

    const milestone = await prisma.projectMilestone.create({
      data: {
        projectId,
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
        sortOrder: sortOrder || 0,
      },
    });

    res.status(201).json(milestone);
  } catch (error) {
    console.error('Error creating milestone:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to create milestone: ${detail}` });
  }
});

// PUT /api/progress/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.projectMilestone.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    const { title, description, dueDate, status, progress, sortOrder } = req.body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'COMPLETED') {
        updateData.completedAt = new Date();
        updateData.progress = 100;
      }
    }
    if (progress !== undefined) updateData.progress = progress;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    const milestone = await prisma.projectMilestone.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json(milestone);
  } catch (error) {
    console.error('Error updating milestone:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to update milestone: ${detail}` });
  }
});

// DELETE /api/progress/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.projectMilestone.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    await prisma.projectMilestone.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Milestone deleted' });
  } catch (error) {
    console.error('Error deleting milestone:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to delete milestone: ${detail}` });
  }
});

export default router;

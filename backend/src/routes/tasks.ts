import { Router, Request, Response } from 'express';
import { prisma } from '../index';

const router = Router();

// GET /api/tasks?projectId=...&status=...&assigneeId=...
router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId, status, assigneeId, priority, page = '1', pageSize = '20' } = req.query;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const where: any = {
      projectId: projectId as string,
      deletedAt: null,
    };

    if (status) where.status = status as string;
    if (priority) where.priority = priority as string;
    if (assigneeId) {
      where.assignments = {
        some: { assigneeId: assigneeId as string },
      };
    }

    const skip = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const take = parseInt(pageSize as string);

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          createdBy: { select: { id: true, fio: true, position: true } },
          assignments: {
            include: {
              assignee: { select: { id: true, fio: true, position: true } },
              assignedBy: { select: { id: true, fio: true } },
            },
          },
          relatedDoc: {
            select: { id: true, title: true, documentNumber: true, documentType: true, status: true },
          },
        },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
      prisma.task.count({ where }),
    ]);

    res.json({ data: tasks, total, page: parseInt(page as string), pageSize: take });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to fetch tasks: ${detail}` });
  }
});

// GET /api/tasks/my - Get tasks assigned to current user
router.get('/my', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { projectId, status } = req.query;

    const where: any = {
      deletedAt: null,
      assignments: {
        some: { assigneeId: userId },
      },
    };

    if (projectId) where.projectId = projectId as string;
    if (status) where.status = status as string;

    const tasks = await prisma.task.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, fio: true } },
        assignments: {
          where: { assigneeId: userId },
          include: {
            assignee: { select: { id: true, fio: true } },
          },
        },
        relatedDoc: {
          select: { id: true, title: true, documentNumber: true, documentType: true },
        },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    });

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching my tasks:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to fetch tasks: ${detail}` });
  }
});

// GET /api/tasks/reminders - Get upcoming reminders
router.get('/reminders', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const tasks = await prisma.task.findMany({
      where: {
        deletedAt: null,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        OR: [
          { dueDate: { lte: nextWeek, gte: now } },
          { reminderDate: { lte: now, gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
          { dueDate: { lt: now } },
        ],
        assignments: {
          some: { assigneeId: userId },
        },
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, fio: true } },
        assignments: {
          include: {
            assignee: { select: { id: true, fio: true } },
          },
        },
        relatedDoc: {
          select: { id: true, title: true, documentType: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    const overdue = tasks.filter(t => t.dueDate && t.dueDate < now);
    const upcoming = tasks.filter(t => t.dueDate && t.dueDate >= now);
    const withReminder = tasks.filter(t => t.reminderDate && !t.reminderSent);

    res.json({ overdue, upcoming, withReminder, total: tasks.length });
  } catch (error) {
    console.error('Error fetching reminders:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to fetch reminders: ${detail}` });
  }
});

// GET /api/tasks/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        project: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, fio: true, position: true } },
        assignments: {
          include: {
            assignee: { select: { id: true, fio: true, position: true, email: true } },
            assignedBy: { select: { id: true, fio: true } },
          },
        },
        relatedDoc: {
          select: { id: true, title: true, documentNumber: true, documentType: true, status: true },
        },
      },
    });

    if (!task || task.deletedAt) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to fetch task: ${detail}` });
  }
});

// POST /api/tasks
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { projectId, title, description, priority, dueDate, reminderDate, relatedDocId, assigneeIds, notes } = req.body;

    if (!projectId || !title) {
      return res.status(400).json({ error: 'projectId and title are required' });
    }

    const task = await prisma.task.create({
      data: {
        projectId,
        title,
        description,
        priority: priority || 'MEDIUM',
        dueDate: dueDate ? new Date(dueDate) : null,
        reminderDate: reminderDate ? new Date(reminderDate) : null,
        relatedDocId: relatedDocId || null,
        notes,
        createdById: userId,
        assignments: assigneeIds?.length ? {
          create: assigneeIds.map((assigneeId: string) => ({
            assigneeId,
            assignedById: userId,
          })),
        } : undefined,
      },
      include: {
        createdBy: { select: { id: true, fio: true } },
        assignments: {
          include: {
            assignee: { select: { id: true, fio: true } },
          },
        },
      },
    });

    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to create task: ${detail}` });
  }
});

// PUT /api/tasks/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { title, description, priority, status, dueDate, reminderDate, notes } = req.body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (priority !== undefined) updateData.priority = priority;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'COMPLETED') updateData.completedAt = new Date();
    }
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (reminderDate !== undefined) updateData.reminderDate = reminderDate ? new Date(reminderDate) : null;
    if (notes !== undefined) updateData.notes = notes;

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        assignments: {
          include: {
            assignee: { select: { id: true, fio: true } },
          },
        },
      },
    });

    res.json(task);
  } catch (error) {
    console.error('Error updating task:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to update task: ${detail}` });
  }
});

// POST /api/tasks/:id/assign
router.post('/:id/assign', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { assigneeId } = req.body;

    if (!assigneeId) {
      return res.status(400).json({ error: 'assigneeId is required' });
    }

    const assignment = await prisma.taskAssignment.create({
      data: {
        taskId: req.params.id,
        assigneeId,
        assignedById: userId,
      },
      include: {
        assignee: { select: { id: true, fio: true, position: true } },
        assignedBy: { select: { id: true, fio: true } },
      },
    });

    res.status(201).json(assignment);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'User is already assigned to this task' });
    }
    console.error('Error assigning task:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to assign task: ${detail}` });
  }
});

// PUT /api/tasks/:id/assignments/:assignmentId
router.put('/:id/assignments/:assignmentId', async (req: Request, res: Response) => {
  try {
    const existingAssignment = await prisma.taskAssignment.findUnique({ where: { id: req.params.assignmentId } });
    if (!existingAssignment || existingAssignment.taskId !== req.params.id) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const { status, comment } = req.body;

    const updateData: any = {};
    if (status) {
      updateData.status = status;
      if (status === 'COMPLETED') updateData.completedAt = new Date();
    }
    if (comment !== undefined) updateData.comment = comment;

    const assignment = await prisma.taskAssignment.update({
      where: { id: req.params.assignmentId },
      data: updateData,
      include: {
        assignee: { select: { id: true, fio: true } },
      },
    });

    res.json(assignment);
  } catch (error) {
    console.error('Error updating assignment:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to update assignment: ${detail}` });
  }
});

// POST /api/tasks/:id/message - Add a message/comment to a task
router.post('/:id/message', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task || task.deletedAt) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const user = await prisma.person.findUnique({
      where: { id: userId },
      select: { id: true, fio: true, role: true },
    });

    // Parse existing notes as JSON array, or start new
    let messages: any[] = [];
    if (task.notes) {
      try { messages = JSON.parse(task.notes); } catch { messages = []; }
    }

    messages.push({
      id: `msg_${Date.now()}`,
      authorId: userId,
      authorName: user?.fio || 'Unknown',
      text,
      createdAt: new Date().toISOString(),
    });

    await prisma.task.update({
      where: { id: req.params.id },
      data: { notes: JSON.stringify(messages) },
    });

    res.status(201).json({ messages });
  } catch (error) {
    console.error('Error adding message:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to add message: ${detail}` });
  }
});

// GET /api/tasks/:id/messages - Get task messages
router.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task || task.deletedAt) {
      return res.status(404).json({ error: 'Task not found' });
    }

    let messages: any[] = [];
    if (task.notes) {
      try { messages = JSON.parse(task.notes); } catch { messages = []; }
    }

    res.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to fetch messages: ${detail}` });
  }
});

// DELETE /api/tasks/:id (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await prisma.task.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    res.json({ message: 'Task deleted' });
  } catch (error) {
    console.error('Error deleting task:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Failed to delete task: ${detail}` });
  }
});

export default router;

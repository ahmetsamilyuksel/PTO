import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import bcrypt from 'bcryptjs';

const router = Router();

// GET /api/team?projectId=...
router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const members = await prisma.projectMember.findMany({
      where: { projectId: projectId as string },
      include: {
        person: {
          select: {
            id: true,
            fio: true,
            position: true,
            role: true,
            email: true,
            phone: true,
            organizationId: true,
            organization: {
              select: { id: true, name: true, shortName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(members);
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// GET /api/team/available?projectId=... - People not yet in project
router.get('/available', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const existingMemberIds = (await prisma.projectMember.findMany({
      where: { projectId: projectId as string },
      select: { personId: true },
    })).map(m => m.personId);

    const availablePersons = await prisma.person.findMany({
      where: {
        deletedAt: null,
        id: { notIn: existingMemberIds },
      },
      select: {
        id: true,
        fio: true,
        position: true,
        role: true,
        email: true,
        phone: true,
        organization: {
          select: { id: true, name: true, shortName: true },
        },
      },
      orderBy: { fio: 'asc' },
    });

    res.json(availablePersons);
  } catch (error) {
    console.error('Error fetching available persons:', error);
    res.status(500).json({ error: 'Failed to fetch available persons' });
  }
});

// POST /api/team/add-member
router.post('/add-member', async (req: Request, res: Response) => {
  try {
    const { projectId, personId, projectRole, canSign } = req.body;

    if (!projectId || !personId || !projectRole) {
      return res.status(400).json({ error: 'projectId, personId, and projectRole are required' });
    }

    const member = await prisma.projectMember.create({
      data: {
        projectId,
        personId,
        projectRole,
        canSign: canSign || false,
      },
      include: {
        person: {
          select: {
            id: true,
            fio: true,
            position: true,
            role: true,
            email: true,
            organization: {
              select: { id: true, name: true, shortName: true },
            },
          },
        },
      },
    });

    res.status(201).json(member);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'This person already has this role in the project' });
    }
    console.error('Error adding member:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// POST /api/team/create-and-add - Create a new user and add to project
router.post('/create-and-add', async (req: Request, res: Response) => {
  try {
    const { projectId, fio, email, position, role, phone, projectRole, canSign, organizationId, password } = req.body;

    if (!projectId || !fio || !email || !projectRole) {
      return res.status(400).json({ error: 'projectId, fio, email, and projectRole are required' });
    }

    const existingPerson = await prisma.person.findUnique({ where: { email } });
    if (existingPerson) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password || 'Temp1234!', 12);

    const person = await prisma.person.create({
      data: {
        fio,
        email,
        position: position || null,
        role: role || 'ENGINEER',
        phone: phone || null,
        passwordHash,
        organizationId: organizationId || null,
      },
    });

    const member = await prisma.projectMember.create({
      data: {
        projectId,
        personId: person.id,
        projectRole,
        canSign: canSign || false,
      },
      include: {
        person: {
          select: {
            id: true,
            fio: true,
            position: true,
            role: true,
            email: true,
            organization: {
              select: { id: true, name: true, shortName: true },
            },
          },
        },
      },
    });

    res.status(201).json(member);
  } catch (error) {
    console.error('Error creating and adding member:', error);
    res.status(500).json({ error: 'Failed to create user and add to project' });
  }
});

// PUT /api/team/:memberId
router.put('/:memberId', async (req: Request, res: Response) => {
  try {
    const { projectRole, canSign } = req.body;

    const member = await prisma.projectMember.update({
      where: { id: req.params.memberId },
      data: {
        ...(projectRole !== undefined && { projectRole }),
        ...(canSign !== undefined && { canSign }),
      },
      include: {
        person: {
          select: {
            id: true,
            fio: true,
            position: true,
            role: true,
            email: true,
          },
        },
      },
    });

    res.json(member);
  } catch (error) {
    console.error('Error updating member:', error);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// DELETE /api/team/:memberId
router.delete('/:memberId', async (req: Request, res: Response) => {
  try {
    await prisma.projectMember.delete({
      where: { id: req.params.memberId },
    });

    res.json({ message: 'Member removed from project' });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;

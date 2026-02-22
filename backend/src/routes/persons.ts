import { Router, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import bcrypt from 'bcryptjs';

const router = Router();

// ─── GET /api/persons ───
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { search, organizationId, role, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = { deletedAt: null };
    if (search) {
      where.OR = [
        { fio: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { position: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    if (organizationId) where.organizationId = organizationId as string;
    if (role) where.role = role as string;

    const [persons, total] = await Promise.all([
      prisma.person.findMany({
        where,
        skip,
        take,
        orderBy: { fio: 'asc' },
        select: {
          id: true,
          fio: true,
          position: true,
          role: true,
          email: true,
          phone: true,
          sroNumber: true,
          sroOrg: true,
          certificateInfo: true,
          organizationId: true,
          organization: { select: { id: true, name: true, shortName: true } },
          createdAt: true,
          updatedAt: true,
          _count: { select: { projectMembers: true } },
        },
      }),
      prisma.person.count({ where }),
    ]);

    return res.json({ data: persons, total, page: parseInt(page as string), limit: take });
  } catch (error) {
    console.error('List persons error:', error);
    return res.status(500).json({ error: 'Error fetching persons list' });
  }
});

// ─── GET /api/persons/:id ───
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const person = await prisma.person.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        fio: true,
        position: true,
        role: true,
        email: true,
        phone: true,
        sroNumber: true,
        sroOrg: true,
        certificateInfo: true,
        organizationId: true,
        organization: { select: { id: true, name: true, shortName: true } },
        projectMembers: {
          include: {
            project: { select: { id: true, name: true, code: true, status: true } },
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!person) {
      return res.status(404).json({ error: 'Person not found' });
    }

    return res.json(person);
  } catch (error) {
    console.error('Get person error:', error);
    return res.status(500).json({ error: 'Error fetching person' });
  }
});

// ─── POST /api/persons ───
router.post('/', requireRole('ADMIN', 'PROJECT_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      fio, email, password, position, role, phone,
      sroNumber, sroOrg, certificateInfo, organizationId,
    } = req.body;

    if (!fio || !email || !password) {
      return res.status(400).json({ error: 'Required fields: fio, email, password' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await prisma.person.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'A person with this email already exists' });
    }

    if (organizationId) {
      const org = await prisma.organization.findUnique({ where: { id: organizationId } });
      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const person = await prisma.person.create({
      data: {
        fio,
        email,
        passwordHash,
        position: position || null,
        role: role || 'ENGINEER',
        phone: phone || null,
        sroNumber: sroNumber || null,
        sroOrg: sroOrg || null,
        certificateInfo: certificateInfo || null,
        organizationId: organizationId || null,
      },
      select: {
        id: true,
        fio: true,
        email: true,
        position: true,
        role: true,
        phone: true,
        sroNumber: true,
        sroOrg: true,
        certificateInfo: true,
        organizationId: true,
        createdAt: true,
      },
    });

    return res.status(201).json(person);
  } catch (error) {
    console.error('Create person error:', error);
    return res.status(500).json({ error: 'Error creating person' });
  }
});

// ─── PUT /api/persons/:id ───
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.person.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: 'Person not found' });
    }

    // Only admin or the person themselves can edit
    if (req.userRole !== 'ADMIN' && req.userId !== req.params.id) {
      return res.status(403).json({ error: 'Insufficient permissions to edit' });
    }

    const {
      fio, position, phone, role, sroNumber, sroOrg,
      certificateInfo, organizationId,
    } = req.body;

    // Only admin can change role
    if (role !== undefined && req.userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Only administrators can change roles' });
    }

    if (organizationId) {
      const org = await prisma.organization.findUnique({ where: { id: organizationId } });
      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }
    }

    const person = await prisma.person.update({
      where: { id: req.params.id },
      data: {
        ...(fio !== undefined && { fio }),
        ...(position !== undefined && { position }),
        ...(phone !== undefined && { phone }),
        ...(role !== undefined && { role }),
        ...(sroNumber !== undefined && { sroNumber }),
        ...(sroOrg !== undefined && { sroOrg }),
        ...(certificateInfo !== undefined && { certificateInfo }),
        ...(organizationId !== undefined && { organizationId }),
      },
      select: {
        id: true,
        fio: true,
        email: true,
        position: true,
        role: true,
        phone: true,
        sroNumber: true,
        sroOrg: true,
        certificateInfo: true,
        organizationId: true,
        updatedAt: true,
      },
    });

    return res.json(person);
  } catch (error) {
    console.error('Update person error:', error);
    return res.status(500).json({ error: 'Error updating person' });
  }
});

// ─── DELETE /api/persons/:id (soft delete) ───
router.delete('/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.person.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: 'Person not found' });
    }

    if (existing.id === req.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await prisma.person.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    return res.json({ message: 'Person deleted' });
  } catch (error) {
    console.error('Delete person error:', error);
    return res.status(500).json({ error: 'Error deleting person' });
  }
});

export default router;

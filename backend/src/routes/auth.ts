import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { config } from '../config';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();

// ─── POST /api/auth/register ───
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, fio, position, phone, role, organizationId } = req.body;

    if (!email || !password || !fio) {
      return res.status(400).json({ error: 'Required fields: email, password, fio' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await prisma.person.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists' });
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
        email,
        passwordHash,
        fio,
        position: position || null,
        phone: phone || null,
        role: role || 'ENGINEER',
        organizationId: organizationId || null,
      },
      select: {
        id: true,
        email: true,
        fio: true,
        position: true,
        role: true,
        phone: true,
        organizationId: true,
        createdAt: true,
      },
    });

    const token = jwt.sign(
      { userId: person.id, role: person.role },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as any }
    );

    return res.status(201).json({ token, user: person });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Error during registration' });
  }
});

// ─── POST /api/auth/login ───
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }

    const person = await prisma.person.findUnique({
      where: { email },
      include: { organization: { select: { id: true, name: true, shortName: true } } },
    });

    if (!person || person.deletedAt) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, person.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: person.id, role: person.role },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as any }
    );

    return res.json({
      token,
      user: {
        id: person.id,
        email: person.email,
        fio: person.fio,
        fullName: person.fio,
        position: person.position,
        role: person.role,
        phone: person.phone,
        organization: person.organization,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Error during login' });
  }
});

// ─── GET /api/auth/me ───
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const person = await prisma.person.findUnique({
      where: { id: req.userId },
      include: {
        organization: { select: { id: true, name: true, shortName: true } },
        projectMembers: {
          include: {
            project: { select: { id: true, name: true, code: true, status: true } },
          },
        },
      },
    });

    if (!person || person.deletedAt) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      id: person.id,
      email: person.email,
      fio: person.fio,
      position: person.position,
      role: person.role,
      phone: person.phone,
      sroNumber: person.sroNumber,
      sroOrg: person.sroOrg,
      certificateInfo: person.certificateInfo,
      organization: person.organization,
      projects: person.projectMembers.map((pm) => ({
        ...pm.project,
        projectRole: pm.projectRole,
        canSign: pm.canSign,
      })),
    });
  } catch (error) {
    console.error('Me error:', error);
    return res.status(500).json({ error: 'Error fetching profile' });
  }
});

// ─── PUT /api/auth/me ───
router.put('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { fio, position, phone, sroNumber, sroOrg, certificateInfo } = req.body;

    const person = await prisma.person.update({
      where: { id: req.userId },
      data: {
        ...(fio !== undefined && { fio }),
        ...(position !== undefined && { position }),
        ...(phone !== undefined && { phone }),
        ...(sroNumber !== undefined && { sroNumber }),
        ...(sroOrg !== undefined && { sroOrg }),
        ...(certificateInfo !== undefined && { certificateInfo }),
      },
      select: {
        id: true,
        email: true,
        fio: true,
        position: true,
        role: true,
        phone: true,
        sroNumber: true,
        sroOrg: true,
        certificateInfo: true,
        organizationId: true,
      },
    });

    return res.json(person);
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Error updating profile' });
  }
});

// ─── PUT /api/auth/change-password ───
router.put('/change-password', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Please provide current and new password' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const person = await prisma.person.findUnique({ where: { id: req.userId } });
    if (!person) {
      return res.status(404).json({ error: 'User not found' });
    }

    const valid = await bcrypt.compare(currentPassword, person.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid current password' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.person.update({
      where: { id: req.userId },
      data: { passwordHash },
    });

    return res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'Error changing password' });
  }
});

export default router;

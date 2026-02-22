import { Router, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest, requireRole } from '../middleware/auth';
import bcrypt from 'bcryptjs';

const router = Router();

// All admin routes require ADMIN role
router.use(requireRole('ADMIN'));

// Permission modules matching frontend sections
const PERMISSION_MODULES = [
  'dashboard', 'documents', 'materials', 'journals', 'tasks',
  'corrections', 'packages', 'templates', 'categories', 'team',
  'matrix', 'progress', 'admin',
] as const;

type PermActions = { view: boolean; create: boolean; edit: boolean; delete: boolean };
type PermMap = Record<string, PermActions>;

function getDefaultPermissions(role: string): PermMap {
  const allTrue: PermActions = { view: true, create: true, edit: true, delete: true };
  const viewOnly: PermActions = { view: true, create: false, edit: false, delete: false };
  const viewCreate: PermActions = { view: true, create: true, edit: false, delete: false };
  const viewCreateEdit: PermActions = { view: true, create: true, edit: true, delete: false };
  const none: PermActions = { view: false, create: false, edit: false, delete: false };

  const base = (): PermMap => Object.fromEntries(PERMISSION_MODULES.map(m => [m, { ...viewOnly }]));

  switch (role) {
    case 'ADMIN':
      return Object.fromEntries(PERMISSION_MODULES.map(m => [m, { ...allTrue }]));
    case 'PROJECT_MANAGER':
      return { ...Object.fromEntries(PERMISSION_MODULES.map(m => [m, { ...allTrue }])), admin: { ...none } };
    case 'SITE_MANAGER':
      return {
        ...Object.fromEntries(PERMISSION_MODULES.map(m => [m, { ...viewCreateEdit }])),
        admin: { ...none },
        dashboard: { ...allTrue },
      };
    case 'ENGINEER':
      return {
        ...Object.fromEntries(PERMISSION_MODULES.map(m => [m, { ...viewCreateEdit }])),
        admin: { ...none },
        dashboard: { ...allTrue },
      };
    case 'TECH_SUPERVISOR':
      return {
        ...base(),
        dashboard: { ...allTrue },
        documents: { ...viewCreate },
        corrections: { ...viewCreateEdit },
        admin: { ...none },
      };
    case 'AUTHOR_SUPERVISOR':
      return {
        ...base(),
        dashboard: { ...allTrue },
        documents: { ...viewCreate },
        corrections: { ...viewCreate },
        admin: { ...none },
      };
    case 'LAB_TECHNICIAN':
      return {
        ...base(),
        dashboard: { ...allTrue },
        materials: { ...viewCreateEdit },
        admin: { ...none },
      };
    case 'SUPPLIER':
      return {
        ...base(),
        dashboard: { ...allTrue },
        materials: { ...viewCreate },
        admin: { ...none },
      };
    case 'HSE_OFFICER':
      return {
        ...base(),
        dashboard: { ...allTrue },
        documents: { ...viewCreate },
        corrections: { ...viewCreateEdit },
        admin: { ...none },
      };
    default:
      return base();
  }
}

// GET /api/admin/users - List all users with their permissions
router.get('/users', async (_req: AuthRequest, res: Response) => {
  try {
    const persons = await prisma.person.findMany({
      where: { deletedAt: null },
      orderBy: { fio: 'asc' },
      select: {
        id: true,
        fio: true,
        position: true,
        role: true,
        email: true,
        phone: true,
        permissions: true,
        organizationId: true,
        organization: { select: { id: true, name: true, shortName: true } },
        createdAt: true,
        _count: { select: { projectMembers: true } },
      },
    });

    // Attach effective permissions (stored or defaults based on role)
    const result = persons.map((p) => ({
      ...p,
      permissions: (p.permissions as PermMap) || getDefaultPermissions(p.role),
    }));

    return res.json(result);
  } catch (error) {
    console.error('Admin list users error:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `Error fetching users: ${detail}` });
  }
});

// GET /api/admin/default-permissions/:role - Get default permissions for a role
router.get('/default-permissions/:role', async (req: AuthRequest, res: Response) => {
  try {
    const perms = getDefaultPermissions(req.params.role);
    return res.json(perms);
  } catch (error) {
    console.error('Admin get defaults error:', error);
    return res.status(500).json({ error: 'Error fetching default permissions' });
  }
});

// PUT /api/admin/users/:id - Update user role, position, permissions
router.put('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.person.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { role, position, permissions } = req.body;

    const person = await prisma.person.update({
      where: { id: req.params.id },
      data: {
        ...(role !== undefined && { role }),
        ...(position !== undefined && { position }),
        ...(permissions !== undefined && { permissions }),
      },
      select: {
        id: true,
        fio: true,
        position: true,
        role: true,
        email: true,
        phone: true,
        permissions: true,
        organizationId: true,
        organization: { select: { id: true, name: true, shortName: true } },
        createdAt: true,
        _count: { select: { projectMembers: true } },
      },
    });

    return res.json({
      ...person,
      permissions: (person.permissions as PermMap) || getDefaultPermissions(person.role),
    });
  } catch (error) {
    console.error('Admin update user error:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `Error updating user: ${detail}` });
  }
});

// POST /api/admin/users - Create a new user
router.post('/users', async (req: AuthRequest, res: Response) => {
  try {
    const { fio, email, password, position, role, phone, organizationId } = req.body;

    if (!fio || !email) {
      return res.status(400).json({ error: 'fio and email are required' });
    }

    const existing = await prisma.person.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password || 'Temp1234!', 12);
    const userRole = role || 'ENGINEER';
    const defaultPerms = getDefaultPermissions(userRole);

    const person = await prisma.person.create({
      data: {
        fio,
        email,
        passwordHash,
        position: position || null,
        role: userRole,
        phone: phone || null,
        organizationId: organizationId || null,
        permissions: defaultPerms,
      },
      select: {
        id: true,
        fio: true,
        position: true,
        role: true,
        email: true,
        phone: true,
        permissions: true,
        organizationId: true,
        organization: { select: { id: true, name: true, shortName: true } },
        createdAt: true,
        _count: { select: { projectMembers: true } },
      },
    });

    return res.status(201).json({
      ...person,
      permissions: (person.permissions as PermMap) || defaultPerms,
    });
  } catch (error) {
    console.error('Admin create user error:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `Error creating user: ${detail}` });
  }
});

// DELETE /api/admin/users/:id - Soft delete user
router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.person.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (existing.id === req.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await prisma.person.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    return res.json({ message: 'User deleted' });
  } catch (error) {
    console.error('Admin delete user error:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `Error deleting user: ${detail}` });
  }
});

export default router;

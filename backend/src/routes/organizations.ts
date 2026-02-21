import { Router, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/auth';

const router = Router();

// ─── GET /api/organizations ───
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { search, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = { deletedAt: null };
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { shortName: { contains: search as string, mode: 'insensitive' } },
        { inn: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { persons: true } },
        },
      }),
      prisma.organization.count({ where }),
    ]);

    return res.json({ data: organizations, total, page: parseInt(page as string), limit: take });
  } catch (error) {
    console.error('List organizations error:', error);
    return res.status(500).json({ error: 'Ошибка при получении списка организаций' });
  }
});

// ─── GET /api/organizations/:id ───
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: {
        persons: {
          where: { deletedAt: null },
          select: { id: true, fio: true, position: true, email: true, role: true },
        },
        _count: {
          select: {
            projectsAsClient: true,
            projectsAsGeneral: true,
            projectsAsSub: true,
            projectsAsDesign: true,
          },
        },
      },
    });

    if (!org || org.deletedAt) {
      return res.status(404).json({ error: 'Организация не найдена' });
    }

    return res.json(org);
  } catch (error) {
    console.error('Get organization error:', error);
    return res.status(500).json({ error: 'Ошибка при получении организации' });
  }
});

// ─── POST /api/organizations ───
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, shortName, inn, kpp, ogrn, address, phone, email } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Обязательное поле: name (наименование организации)' });
    }

    if (inn) {
      if (![10, 12].includes(inn.length)) {
        return res.status(400).json({ error: 'ИНН должен содержать 10 или 12 цифр' });
      }
    }

    const org = await prisma.organization.create({
      data: {
        name,
        shortName: shortName || null,
        inn: inn || null,
        kpp: kpp || null,
        ogrn: ogrn || null,
        address: address || null,
        phone: phone || null,
        email: email || null,
      },
    });

    return res.status(201).json(org);
  } catch (error) {
    console.error('Create organization error:', error);
    return res.status(500).json({ error: 'Ошибка при создании организации' });
  }
});

// ─── PUT /api/organizations/:id ───
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: 'Организация не найдена' });
    }

    const { name, shortName, inn, kpp, ogrn, address, phone, email } = req.body;

    if (inn && ![10, 12].includes(inn.length)) {
      return res.status(400).json({ error: 'ИНН должен содержать 10 или 12 цифр' });
    }

    const org = await prisma.organization.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(shortName !== undefined && { shortName }),
        ...(inn !== undefined && { inn }),
        ...(kpp !== undefined && { kpp }),
        ...(ogrn !== undefined && { ogrn }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
      },
    });

    return res.json(org);
  } catch (error) {
    console.error('Update organization error:', error);
    return res.status(500).json({ error: 'Ошибка при обновлении организации' });
  }
});

// ─── DELETE /api/organizations/:id ───
router.delete('/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: 'Организация не найдена' });
    }

    await prisma.organization.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    return res.json({ message: 'Организация удалена' });
  } catch (error) {
    console.error('Delete organization error:', error);
    return res.status(500).json({ error: 'Ошибка при удалении организации' });
  }
});

export default router;

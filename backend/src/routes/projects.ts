import { Router, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/auth';

const router = Router();

// ─── GET /api/projects ───
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status, search, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = { deletedAt: null };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { code: { contains: search as string, mode: 'insensitive' } },
        { address: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // Non-admin users see only their projects
    if (req.userRole !== 'ADMIN') {
      where.members = { some: { personId: req.userId } };
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: {
          clientOrg: { select: { id: true, name: true, shortName: true } },
          generalOrg: { select: { id: true, name: true, shortName: true } },
          _count: {
            select: {
              documents: true,
              workItems: true,
              members: true,
            },
          },
        },
      }),
      prisma.project.count({ where }),
    ]);

    return res.json({ data: projects, total, page: parseInt(page as string), limit: take });
  } catch (error) {
    console.error('List projects error:', error);
    return res.status(500).json({ error: 'Ошибка при получении списка проектов' });
  }
});

// ─── GET /api/projects/:id ───
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        clientOrg: true,
        generalOrg: true,
        subOrg: true,
        designOrg: true,
        members: {
          include: {
            person: {
              select: { id: true, fio: true, position: true, email: true, role: true },
            },
          },
        },
        _count: {
          select: {
            documents: true,
            workItems: true,
            locations: true,
            materials: true,
            journals: true,
            packages: true,
          },
        },
      },
    });

    if (!project || project.deletedAt) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    return res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    return res.status(500).json({ error: 'Ошибка при получении проекта' });
  }
});

// ─── POST /api/projects ───
router.post('/', requireRole('ADMIN', 'PROJECT_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      name, code, address, contractNumber, contractDate,
      projectType, startDate, plannedEndDate, normativeSet,
      documentLang, description, status,
      clientOrgId, generalOrgId, subOrgId, designOrgId,
    } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Обязательные поля: name, code' });
    }

    const existingCode = await prisma.project.findUnique({ where: { code } });
    if (existingCode) {
      return res.status(409).json({ error: 'Проект с таким кодом уже существует' });
    }

    const project = await prisma.project.create({
      data: {
        name,
        code,
        address: address || null,
        contractNumber: contractNumber || null,
        contractDate: contractDate ? new Date(contractDate) : null,
        projectType: projectType || 'NEW_CONSTRUCTION',
        startDate: startDate ? new Date(startDate) : null,
        plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
        normativeSet: normativeSet || undefined,
        documentLang: documentLang || undefined,
        description: description || null,
        status: status || 'DRAFT',
        clientOrgId: clientOrgId || null,
        generalOrgId: generalOrgId || null,
        subOrgId: subOrgId || null,
        designOrgId: designOrgId || null,
      },
    });

    // Auto-add creator as project member
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        personId: req.userId!,
        projectRole: 'QA_ENGINEER',
        canSign: true,
      },
    });

    return res.status(201).json(project);
  } catch (error) {
    console.error('Create project error:', error);
    return res.status(500).json({ error: 'Ошибка при создании проекта' });
  }
});

// ─── POST /api/projects/setup-wizard ───
router.post('/setup-wizard', requireRole('ADMIN', 'PROJECT_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      // Step 1: Project info
      name, code, address, contractNumber, contractDate,
      projectType, startDate, plannedEndDate, description,
      // Step 2: Organizations
      clientOrgId, generalOrgId, subOrgId, designOrgId,
      // Step 3: Members
      members, // [{ personId, projectRole, canSign }]
      // Step 4: Locations
      locations, // [{ name, locationType, parentName?, sortOrder }]
      // Step 5: Initial journals
      journalTypes, // ['GENERAL', 'CONCRETE', ...]
    } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Обязательные поля: name, code' });
    }

    const existingCode = await prisma.project.findUnique({ where: { code } });
    if (existingCode) {
      return res.status(409).json({ error: 'Проект с таким кодом уже существует' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Create project
      const project = await tx.project.create({
        data: {
          name,
          code,
          address: address || null,
          contractNumber: contractNumber || null,
          contractDate: contractDate ? new Date(contractDate) : null,
          projectType: projectType || 'NEW_CONSTRUCTION',
          startDate: startDate ? new Date(startDate) : null,
          plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
          description: description || null,
          status: 'ACTIVE',
          clientOrgId: clientOrgId || null,
          generalOrgId: generalOrgId || null,
          subOrgId: subOrgId || null,
          designOrgId: designOrgId || null,
        },
      });

      // Step 2: Add creator
      await tx.projectMember.create({
        data: {
          projectId: project.id,
          personId: req.userId!,
          projectRole: 'QA_ENGINEER',
          canSign: true,
        },
      });

      // Step 3: Add members
      if (Array.isArray(members) && members.length > 0) {
        for (const m of members) {
          if (m.personId === req.userId) continue; // skip creator
          await tx.projectMember.create({
            data: {
              projectId: project.id,
              personId: m.personId,
              projectRole: m.projectRole || 'OTHER',
              canSign: m.canSign || false,
            },
          });
        }
      }

      // Step 4: Create locations
      const locationMap = new Map<string, string>(); // name -> id
      if (Array.isArray(locations) && locations.length > 0) {
        for (const loc of locations) {
          const parentId = loc.parentName ? locationMap.get(loc.parentName) || null : null;
          const created = await tx.location.create({
            data: {
              projectId: project.id,
              name: loc.name,
              locationType: loc.locationType || 'BUILDING',
              parentId,
              sortOrder: loc.sortOrder || 0,
            },
          });
          locationMap.set(loc.name, created.id);
        }
      }

      // Step 5: Create journals
      if (Array.isArray(journalTypes) && journalTypes.length > 0) {
        const journalTitles: Record<string, string> = {
          GENERAL: 'Общий журнал работ',
          CONCRETE: 'Журнал бетонных работ',
          WELDING: 'Журнал сварочных работ',
          ANTICORROSION: 'Журнал антикоррозионных работ',
          INSULATION: 'Журнал изоляционных работ',
          PILE_DRIVING: 'Журнал забивки свай',
          GEODETIC: 'Журнал геодезических работ',
          INSTALLATION: 'Журнал монтажных работ',
          OTHER: 'Прочий журнал',
        };

        for (const jt of journalTypes) {
          await tx.journal.create({
            data: {
              projectId: project.id,
              journalType: jt,
              title: journalTitles[jt] || `Журнал (${jt})`,
              startDate: startDate ? new Date(startDate) : new Date(),
              status: 'ACTIVE',
            },
          });
        }
      }

      return project;
    });

    const full = await prisma.project.findUnique({
      where: { id: result.id },
      include: {
        clientOrg: true,
        generalOrg: true,
        members: { include: { person: { select: { id: true, fio: true, position: true } } } },
        locations: true,
        journals: true,
      },
    });

    return res.status(201).json(full);
  } catch (error) {
    console.error('Setup wizard error:', error);
    return res.status(500).json({ error: 'Ошибка при создании проекта через мастер настройки' });
  }
});

// ─── PUT /api/projects/:id ───
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    const {
      name, address, contractNumber, contractDate,
      projectType, startDate, plannedEndDate, normativeSet,
      documentLang, description, status,
      clientOrgId, generalOrgId, subOrgId, designOrgId,
    } = req.body;

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(address !== undefined && { address }),
        ...(contractNumber !== undefined && { contractNumber }),
        ...(contractDate !== undefined && { contractDate: contractDate ? new Date(contractDate) : null }),
        ...(projectType !== undefined && { projectType }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(plannedEndDate !== undefined && { plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null }),
        ...(normativeSet !== undefined && { normativeSet }),
        ...(documentLang !== undefined && { documentLang }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(clientOrgId !== undefined && { clientOrgId }),
        ...(generalOrgId !== undefined && { generalOrgId }),
        ...(subOrgId !== undefined && { subOrgId }),
        ...(designOrgId !== undefined && { designOrgId }),
      },
    });

    return res.json(project);
  } catch (error) {
    console.error('Update project error:', error);
    return res.status(500).json({ error: 'Ошибка при обновлении проекта' });
  }
});

// ─── DELETE /api/projects/:id ───
router.delete('/:id', requireRole('ADMIN', 'PROJECT_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    await prisma.project.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    return res.json({ message: 'Проект удалён' });
  } catch (error) {
    console.error('Delete project error:', error);
    return res.status(500).json({ error: 'Ошибка при удалении проекта' });
  }
});

// ─── POST /api/projects/:id/members ───
router.post('/:id/members', async (req: AuthRequest, res: Response) => {
  try {
    const { personId, projectRole, canSign } = req.body;

    if (!personId || !projectRole) {
      return res.status(400).json({ error: 'Обязательные поля: personId, projectRole' });
    }

    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project || project.deletedAt) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    const person = await prisma.person.findUnique({ where: { id: personId } });
    if (!person || person.deletedAt) {
      return res.status(404).json({ error: 'Сотрудник не найден' });
    }

    const member = await prisma.projectMember.create({
      data: {
        projectId: req.params.id,
        personId,
        projectRole,
        canSign: canSign || false,
      },
      include: {
        person: { select: { id: true, fio: true, position: true, email: true } },
      },
    });

    return res.status(201).json(member);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Участник с такой ролью уже добавлен в проект' });
    }
    console.error('Add member error:', error);
    return res.status(500).json({ error: 'Ошибка при добавлении участника' });
  }
});

// ─── DELETE /api/projects/:id/members/:memberId ───
router.delete('/:id/members/:memberId', async (req: AuthRequest, res: Response) => {
  try {
    const member = await prisma.projectMember.findUnique({ where: { id: req.params.memberId } });
    if (!member || member.projectId !== req.params.id) {
      return res.status(404).json({ error: 'Участник проекта не найден' });
    }

    await prisma.projectMember.delete({ where: { id: req.params.memberId } });

    return res.json({ message: 'Участник удалён из проекта' });
  } catch (error) {
    console.error('Remove member error:', error);
    return res.status(500).json({ error: 'Ошибка при удалении участника' });
  }
});

export default router;

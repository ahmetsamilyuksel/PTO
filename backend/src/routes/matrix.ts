import { Router, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/auth';

const router = Router();

// ─── GET /api/matrix?projectId=... ───
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, workType, documentType, isActive } = req.query;

    const where: any = {};
    if (projectId) where.projectId = projectId as string;
    if (workType) where.workType = workType as string;
    if (documentType) where.documentType = documentType as string;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const rules = await prisma.documentMatrixRule.findMany({
      where,
      orderBy: [{ workType: 'asc' }, { sortOrder: 'asc' }, { documentType: 'asc' }],
      include: {
        project: { select: { id: true, name: true, code: true } },
      },
    });

    return res.json({ data: rules });
  } catch (error) {
    console.error('List matrix rules error:', error);
    return res.status(500).json({ error: 'Ошибка при получении правил матрицы документов' });
  }
});

// ─── GET /api/matrix/:id ───
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const rule = await prisma.documentMatrixRule.findUnique({
      where: { id: req.params.id },
      include: {
        project: { select: { id: true, name: true, code: true } },
      },
    });

    if (!rule) {
      return res.status(404).json({ error: 'Правило матрицы не найдено' });
    }

    return res.json(rule);
  } catch (error) {
    console.error('Get matrix rule error:', error);
    return res.status(500).json({ error: 'Ошибка при получении правила матрицы' });
  }
});

// ─── POST /api/matrix ───
router.post('/', requireRole('ADMIN', 'PROJECT_MANAGER', 'ENGINEER'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      projectId, workType, documentType, triggerEvent,
      preparedByRole, checkedByRole, signedByRoles,
      requiredAttachments, requiredFields,
      linkedJournalType, sortOrder,
    } = req.body;

    if (!workType || !documentType || !triggerEvent || !preparedByRole || !signedByRoles) {
      return res.status(400).json({
        error: 'Обязательные поля: workType, documentType, triggerEvent, preparedByRole, signedByRoles',
      });
    }

    if (!Array.isArray(signedByRoles) || signedByRoles.length === 0) {
      return res.status(400).json({ error: 'signedByRoles должен быть непустым массивом ролей' });
    }

    if (projectId) {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project || project.deletedAt) {
        return res.status(404).json({ error: 'Проект не найден' });
      }
    }

    const rule = await prisma.documentMatrixRule.create({
      data: {
        projectId: projectId || null,
        workType,
        documentType,
        triggerEvent,
        preparedByRole,
        checkedByRole: checkedByRole || null,
        signedByRoles,
        requiredAttachments: requiredAttachments || null,
        requiredFields: requiredFields || null,
        linkedJournalType: linkedJournalType || null,
        sortOrder: sortOrder || 0,
        isActive: true,
      },
    });

    return res.status(201).json(rule);
  } catch (error) {
    console.error('Create matrix rule error:', error);
    return res.status(500).json({ error: 'Ошибка при создании правила матрицы' });
  }
});

// ─── PUT /api/matrix/:id ───
router.put('/:id', requireRole('ADMIN', 'PROJECT_MANAGER', 'ENGINEER'), async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.documentMatrixRule.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Правило матрицы не найдено' });
    }

    const {
      workType, documentType, triggerEvent,
      preparedByRole, checkedByRole, signedByRoles,
      requiredAttachments, requiredFields,
      linkedJournalType, isActive, sortOrder,
    } = req.body;

    if (signedByRoles !== undefined && (!Array.isArray(signedByRoles) || signedByRoles.length === 0)) {
      return res.status(400).json({ error: 'signedByRoles должен быть непустым массивом ролей' });
    }

    const rule = await prisma.documentMatrixRule.update({
      where: { id: req.params.id },
      data: {
        ...(workType !== undefined && { workType }),
        ...(documentType !== undefined && { documentType }),
        ...(triggerEvent !== undefined && { triggerEvent }),
        ...(preparedByRole !== undefined && { preparedByRole }),
        ...(checkedByRole !== undefined && { checkedByRole }),
        ...(signedByRoles !== undefined && { signedByRoles }),
        ...(requiredAttachments !== undefined && { requiredAttachments }),
        ...(requiredFields !== undefined && { requiredFields }),
        ...(linkedJournalType !== undefined && { linkedJournalType }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });

    return res.json(rule);
  } catch (error) {
    console.error('Update matrix rule error:', error);
    return res.status(500).json({ error: 'Ошибка при обновлении правила матрицы' });
  }
});

// ─── DELETE /api/matrix/:id ───
router.delete('/:id', requireRole('ADMIN', 'PROJECT_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.documentMatrixRule.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Правило матрицы не найдено' });
    }

    await prisma.documentMatrixRule.delete({ where: { id: req.params.id } });

    return res.json({ message: 'Правило матрицы удалено' });
  } catch (error) {
    console.error('Delete matrix rule error:', error);
    return res.status(500).json({ error: 'Ошибка при удалении правила матрицы' });
  }
});

// ─── POST /api/matrix/apply ───
// Apply matrix rules to auto-generate required documents for a work item
router.post('/apply', async (req: AuthRequest, res: Response) => {
  try {
    const { workItemId, triggerEvent } = req.body;

    if (!workItemId || !triggerEvent) {
      return res.status(400).json({ error: 'Обязательные поля: workItemId, triggerEvent' });
    }

    const workItem = await prisma.workItem.findUnique({
      where: { id: workItemId },
      include: {
        project: {
          include: {
            members: { include: { person: true } },
          },
        },
      },
    });

    if (!workItem || workItem.deletedAt) {
      return res.status(404).json({ error: 'Работа не найдена' });
    }

    // Find applicable rules (project-specific first, then global)
    const rules = await prisma.documentMatrixRule.findMany({
      where: {
        workType: workItem.workType,
        triggerEvent,
        isActive: true,
        OR: [
          { projectId: workItem.projectId },
          { projectId: null },
        ],
      },
      orderBy: [{ projectId: 'desc' }, { sortOrder: 'asc' }], // Project-specific first
    });

    if (rules.length === 0) {
      return res.json({ message: 'Нет применимых правил матрицы', documents: [] });
    }

    // Deduplicate by documentType (project rules override global)
    const seenTypes = new Set<string>();
    const applicableRules = rules.filter((rule) => {
      if (seenTypes.has(rule.documentType)) return false;
      seenTypes.add(rule.documentType);
      return true;
    });

    const createdDocuments = [];

    for (const rule of applicableRules) {
      // Check if document already exists for this work item + type
      const existing = await prisma.document.findFirst({
        where: {
          projectId: workItem.projectId,
          workItemId,
          documentType: rule.documentType,
          deletedAt: null,
        },
      });

      if (existing) continue; // Skip if already exists

      // Find the person for preparedByRole
      const preparer = workItem.project.members.find(
        (m) => m.projectRole === rule.preparedByRole
      );

      // Find template
      const template = await prisma.documentTemplate.findFirst({
        where: { documentType: rule.documentType, isActive: true },
        orderBy: { version: 'desc' },
      });

      const doc = await prisma.document.create({
        data: {
          projectId: workItem.projectId,
          documentType: rule.documentType,
          title: `${rule.documentType} — ${workItem.name}`,
          templateId: template?.id || null,
          locationId: workItem.locationId,
          workItemId,
          createdById: preparer?.personId || req.userId!,
          status: 'DRAFT',
          revision: 1,
          data: {
            matrixRuleId: rule.id,
            triggerEvent,
            requiredFields: rule.requiredFields,
          },
        },
      });

      // Add signatures based on signedByRoles
      const signedByRoles = rule.signedByRoles as string[];
      for (let i = 0; i < signedByRoles.length; i++) {
        const signerRole = signedByRoles[i];
        const signer = workItem.project.members.find(
          (m) => m.projectRole === signerRole
        );
        if (signer) {
          await prisma.documentSignature.create({
            data: {
              documentId: doc.id,
              personId: signer.personId,
              signRole: signerRole === 'TECH_SUPERVISOR_REP' ? 'TECH_SUPERVISOR' :
                        signerRole === 'AUTHOR_SUPERVISOR_REP' ? 'AUTHOR_SUPERVISOR' :
                        signerRole === 'RESPONSIBLE_PRODUCER' ? 'CONTRACTOR' : 'APPROVED_BY',
              sortOrder: i,
              status: 'PENDING',
            },
          });
        }
      }

      createdDocuments.push(doc);
    }

    return res.json({
      message: `Создано ${createdDocuments.length} документов по матрице`,
      rulesApplied: applicableRules.length,
      documents: createdDocuments,
    });
  } catch (error) {
    console.error('Apply matrix error:', error);
    return res.status(500).json({ error: 'Ошибка при применении правил матрицы' });
  }
});

// ─── POST /api/matrix/seed-defaults ───
// Seed default matrix rules for common work types
router.post('/seed-defaults', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.body;

    const defaults = [
      {
        workType: 'CONCRETE' as const,
        documentType: 'AOSR' as const,
        triggerEvent: 'WORK_COMPLETED',
        preparedByRole: 'RESPONSIBLE_PRODUCER' as const,
        checkedByRole: 'QA_ENGINEER' as const,
        signedByRoles: ['RESPONSIBLE_PRODUCER', 'TECH_SUPERVISOR_REP', 'AUTHOR_SUPERVISOR_REP'],
        linkedJournalType: 'CONCRETE' as const,
      },
      {
        workType: 'CONCRETE' as const,
        documentType: 'AOOK' as const,
        triggerEvent: 'STRUCTURE_COMPLETED',
        preparedByRole: 'RESPONSIBLE_PRODUCER' as const,
        checkedByRole: 'QA_ENGINEER' as const,
        signedByRoles: ['RESPONSIBLE_PRODUCER', 'TECH_SUPERVISOR_REP', 'AUTHOR_SUPERVISOR_REP'],
        linkedJournalType: 'CONCRETE' as const,
      },
      {
        workType: 'REINFORCEMENT' as const,
        documentType: 'AOSR' as const,
        triggerEvent: 'WORK_COMPLETED',
        preparedByRole: 'RESPONSIBLE_PRODUCER' as const,
        checkedByRole: 'QA_ENGINEER' as const,
        signedByRoles: ['RESPONSIBLE_PRODUCER', 'TECH_SUPERVISOR_REP'],
        linkedJournalType: 'GENERAL' as const,
      },
      {
        workType: 'WATERPROOFING' as const,
        documentType: 'AOSR' as const,
        triggerEvent: 'WORK_COMPLETED',
        preparedByRole: 'RESPONSIBLE_PRODUCER' as const,
        signedByRoles: ['RESPONSIBLE_PRODUCER', 'TECH_SUPERVISOR_REP'],
        linkedJournalType: 'GENERAL' as const,
      },
      {
        workType: 'GEODETIC' as const,
        documentType: 'GEODETIC_ACT' as const,
        triggerEvent: 'SURVEY_COMPLETED',
        preparedByRole: 'RESPONSIBLE_PRODUCER' as const,
        signedByRoles: ['RESPONSIBLE_PRODUCER', 'TECH_SUPERVISOR_REP'],
        linkedJournalType: 'GEODETIC' as const,
      },
    ];

    let created = 0;
    for (const rule of defaults) {
      const exists = await prisma.documentMatrixRule.findFirst({
        where: {
          projectId: projectId || null,
          workType: rule.workType,
          documentType: rule.documentType,
          triggerEvent: rule.triggerEvent,
        },
      });

      if (!exists) {
        await prisma.documentMatrixRule.create({
          data: {
            projectId: projectId || null,
            ...rule,
            isActive: true,
            sortOrder: created,
          },
        });
        created++;
      }
    }

    return res.json({ message: `Создано ${created} правил матрицы по умолчанию`, total: defaults.length });
  } catch (error) {
    console.error('Seed defaults error:', error);
    return res.status(500).json({ error: 'Ошибка при создании правил по умолчанию' });
  }
});

export default router;

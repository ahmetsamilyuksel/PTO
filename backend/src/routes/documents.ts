import { Router, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// ─── GET /api/documents?projectId=... ───
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      projectId, documentType, status, locationId, workItemId,
      search, page = '1', limit = '20',
    } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'Обязательный параметр: projectId' });
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = { projectId: projectId as string, deletedAt: null };
    if (documentType) where.documentType = documentType as string;
    if (status) where.status = status as string;
    if (locationId) where.locationId = locationId as string;
    if (workItemId) where.workItemId = workItemId as string;
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { documentNumber: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: {
          createdBy: { select: { id: true, fio: true, position: true } },
          location: { select: { id: true, name: true } },
          workItem: { select: { id: true, code: true, name: true } },
          template: { select: { id: true, name: true } },
          _count: { select: { signatures: true, attachments: true, revisions: true } },
        },
      }),
      prisma.document.count({ where }),
    ]);

    return res.json({ data: documents, total, page: parseInt(page as string), limit: take });
  } catch (error) {
    console.error('List documents error:', error);
    return res.status(500).json({ error: 'Ошибка при получении списка документов' });
  }
});

// ─── GET /api/documents/:id ───
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { id: true, fio: true, position: true, email: true } },
        location: { select: { id: true, name: true, locationType: true } },
        workItem: { select: { id: true, code: true, name: true, workType: true } },
        template: { select: { id: true, name: true, documentType: true } },
        parentDoc: { select: { id: true, title: true, documentNumber: true, revision: true } },
        revisions: {
          select: { id: true, title: true, documentNumber: true, revision: true, status: true, createdAt: true },
          orderBy: { revision: 'desc' },
        },
        signatures: {
          include: {
            person: { select: { id: true, fio: true, position: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
        },
        workflowHistory: {
          include: {
            performedBy: { select: { id: true, fio: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!document || document.deletedAt) {
      return res.status(404).json({ error: 'Документ не найден' });
    }

    return res.json(document);
  } catch (error) {
    console.error('Get document error:', error);
    return res.status(500).json({ error: 'Ошибка при получении документа' });
  }
});

// ─── POST /api/documents ───
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      projectId, documentType, title, documentNumber,
      templateId, locationId, workItemId,
      data, documentDate,
    } = req.body;

    if (!projectId || !documentType || !title) {
      return res.status(400).json({ error: 'Обязательные поля: projectId, documentType, title' });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.deletedAt) {
      return res.status(404).json({ error: 'Проект не найден' });
    }

    if (templateId) {
      const template = await prisma.documentTemplate.findUnique({ where: { id: templateId } });
      if (!template || !template.isActive) {
        return res.status(404).json({ error: 'Шаблон документа не найден или неактивен' });
      }
    }

    if (locationId) {
      const location = await prisma.location.findUnique({ where: { id: locationId } });
      if (!location || location.deletedAt || location.projectId !== projectId) {
        return res.status(404).json({ error: 'Локация не найдена' });
      }
    }

    if (workItemId) {
      const workItem = await prisma.workItem.findUnique({ where: { id: workItemId } });
      if (!workItem || workItem.deletedAt || workItem.projectId !== projectId) {
        return res.status(404).json({ error: 'Работа не найдена' });
      }
    }

    const document = await prisma.document.create({
      data: {
        projectId,
        documentType,
        title,
        documentNumber: documentNumber || null,
        templateId: templateId || null,
        locationId: locationId || null,
        workItemId: workItemId || null,
        data: data || null,
        documentDate: documentDate ? new Date(documentDate) : new Date(),
        createdById: req.userId!,
        status: 'DRAFT',
        revision: 1,
      },
      include: {
        createdBy: { select: { id: true, fio: true, position: true } },
      },
    });

    return res.status(201).json(document);
  } catch (error) {
    console.error('Create document error:', error);
    return res.status(500).json({ error: 'Ошибка при создании документа' });
  }
});

// ─── PUT /api/documents/:id ───
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: 'Документ не найден' });
    }

    if (existing.lockedAt) {
      return res.status(400).json({ error: 'Документ заблокирован после подписания и не может быть изменён' });
    }

    if (!['DRAFT', 'REVISION_REQUESTED'].includes(existing.status)) {
      return res.status(400).json({ error: 'Редактирование доступно только для черновиков и документов на доработке' });
    }

    const {
      title, documentNumber, documentType,
      locationId, workItemId, data, documentDate,
    } = req.body;

    const document = await prisma.document.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(documentNumber !== undefined && { documentNumber }),
        ...(documentType !== undefined && { documentType }),
        ...(locationId !== undefined && { locationId }),
        ...(workItemId !== undefined && { workItemId }),
        ...(data !== undefined && { data }),
        ...(documentDate !== undefined && { documentDate: new Date(documentDate) }),
      },
      include: {
        createdBy: { select: { id: true, fio: true, position: true } },
      },
    });

    return res.json(document);
  } catch (error) {
    console.error('Update document error:', error);
    return res.status(500).json({ error: 'Ошибка при обновлении документа' });
  }
});

// ─── POST /api/documents/:id/revision ───
router.post('/:id/revision', async (req: AuthRequest, res: Response) => {
  try {
    const original = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: { attachments: true },
    });

    if (!original || original.deletedAt) {
      return res.status(404).json({ error: 'Документ не найден' });
    }

    if (!['SIGNED', 'IN_PACKAGE'].includes(original.status)) {
      return res.status(400).json({ error: 'Ревизию можно создать только для подписанного документа' });
    }

    const { reason } = req.body;

    const revision = await prisma.document.create({
      data: {
        projectId: original.projectId,
        documentType: original.documentType,
        title: original.title,
        documentNumber: original.documentNumber,
        templateId: original.templateId,
        locationId: original.locationId,
        workItemId: original.workItemId,
        data: original.data ?? undefined,
        documentDate: new Date(),
        createdById: req.userId!,
        status: 'DRAFT',
        revision: original.revision + 1,
        parentDocId: original.id,
      },
      include: {
        createdBy: { select: { id: true, fio: true, position: true } },
        parentDoc: { select: { id: true, title: true, revision: true } },
      },
    });

    // Log workflow transition for original
    await prisma.workflowTransition.create({
      data: {
        documentId: original.id,
        fromStatus: original.status,
        toStatus: original.status,
        performedById: req.userId!,
        comment: `Создана ревизия ${revision.revision}` + (reason ? `: ${reason}` : ''),
      },
    });

    return res.status(201).json(revision);
  } catch (error) {
    console.error('Create revision error:', error);
    return res.status(500).json({ error: 'Ошибка при создании ревизии документа' });
  }
});

// ─── POST /api/documents/:id/signatures ───
router.post('/:id/signatures', async (req: AuthRequest, res: Response) => {
  try {
    const document = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!document || document.deletedAt) {
      return res.status(404).json({ error: 'Документ не найден' });
    }

    const { personId, signRole, sortOrder } = req.body;

    if (!personId || !signRole) {
      return res.status(400).json({ error: 'Обязательные поля: personId, signRole' });
    }

    const person = await prisma.person.findUnique({ where: { id: personId } });
    if (!person || person.deletedAt) {
      return res.status(404).json({ error: 'Сотрудник не найден' });
    }

    const signature = await prisma.documentSignature.create({
      data: {
        documentId: req.params.id,
        personId,
        signRole,
        sortOrder: sortOrder || 0,
        status: 'PENDING',
      },
      include: {
        person: { select: { id: true, fio: true, position: true } },
      },
    });

    return res.status(201).json(signature);
  } catch (error) {
    console.error('Add signature error:', error);
    return res.status(500).json({ error: 'Ошибка при добавлении подписанта' });
  }
});

// ─── PUT /api/documents/:docId/signatures/:sigId/sign ───
router.put('/:docId/signatures/:sigId/sign', async (req: AuthRequest, res: Response) => {
  try {
    const signature = await prisma.documentSignature.findUnique({ where: { id: req.params.sigId } });
    if (!signature || signature.documentId !== req.params.docId) {
      return res.status(404).json({ error: 'Подпись не найдена' });
    }

    if (signature.personId !== req.userId) {
      return res.status(403).json({ error: 'Можно подписывать только от своего имени' });
    }

    if (signature.status !== 'PENDING') {
      return res.status(400).json({ error: 'Подпись уже обработана' });
    }

    const { comment } = req.body;

    const updated = await prisma.documentSignature.update({
      where: { id: req.params.sigId },
      data: {
        status: 'SIGNED',
        signedAt: new Date(),
        comment: comment || null,
        stampData: {
          signedBy: req.userId,
          signedAt: new Date().toISOString(),
          ip: req.ip,
        },
      },
      include: {
        person: { select: { id: true, fio: true, position: true } },
      },
    });

    // Check if all signatures are complete
    const pendingCount = await prisma.documentSignature.count({
      where: { documentId: req.params.docId, status: 'PENDING' },
    });

    if (pendingCount === 0) {
      // All signed - update document status and lock
      const doc = await prisma.document.findUnique({ where: { id: req.params.docId } });
      if (doc) {
        await prisma.document.update({
          where: { id: req.params.docId },
          data: { status: 'SIGNED', lockedAt: new Date() },
        });

        await prisma.workflowTransition.create({
          data: {
            documentId: req.params.docId,
            fromStatus: doc.status,
            toStatus: 'SIGNED',
            performedById: req.userId!,
            comment: 'Все подписи получены',
          },
        });
      }
    }

    return res.json(updated);
  } catch (error) {
    console.error('Sign document error:', error);
    return res.status(500).json({ error: 'Ошибка при подписании документа' });
  }
});

// ─── PUT /api/documents/:docId/signatures/:sigId/reject ───
router.put('/:docId/signatures/:sigId/reject', async (req: AuthRequest, res: Response) => {
  try {
    const signature = await prisma.documentSignature.findUnique({ where: { id: req.params.sigId } });
    if (!signature || signature.documentId !== req.params.docId) {
      return res.status(404).json({ error: 'Подпись не найдена' });
    }

    if (signature.personId !== req.userId) {
      return res.status(403).json({ error: 'Можно отклонять только от своего имени' });
    }

    if (signature.status !== 'PENDING') {
      return res.status(400).json({ error: 'Подпись уже обработана' });
    }

    const { comment } = req.body;
    if (!comment) {
      return res.status(400).json({ error: 'Укажите причину отклонения (comment)' });
    }

    const updated = await prisma.documentSignature.update({
      where: { id: req.params.sigId },
      data: {
        status: 'REJECTED',
        signedAt: new Date(),
        comment,
      },
      include: {
        person: { select: { id: true, fio: true, position: true } },
      },
    });

    // Move document back to revision requested
    const doc = await prisma.document.findUnique({ where: { id: req.params.docId } });
    if (doc) {
      await prisma.document.update({
        where: { id: req.params.docId },
        data: { status: 'REVISION_REQUESTED' },
      });

      await prisma.workflowTransition.create({
        data: {
          documentId: req.params.docId,
          fromStatus: doc.status,
          toStatus: 'REVISION_REQUESTED',
          performedById: req.userId!,
          comment: `Отклонено: ${comment}`,
        },
      });
    }

    return res.json(updated);
  } catch (error) {
    console.error('Reject signature error:', error);
    return res.status(500).json({ error: 'Ошибка при отклонении подписи' });
  }
});

// ─── DELETE /api/documents/:id ───
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: 'Документ не найден' });
    }

    if (existing.lockedAt) {
      return res.status(400).json({ error: 'Нельзя удалить подписанный документ' });
    }

    if (!['DRAFT', 'REVISION_REQUESTED'].includes(existing.status)) {
      return res.status(400).json({ error: 'Можно удалить только черновик или документ на доработке' });
    }

    await prisma.document.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    return res.json({ message: 'Документ удалён' });
  } catch (error) {
    console.error('Delete document error:', error);
    return res.status(500).json({ error: 'Ошибка при удалении документа' });
  }
});

// ─── POST /api/documents/:id/generate ───
router.post('/:id/generate', async (req: AuthRequest, res: Response) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: {
        template: true,
        project: {
          include: {
            clientOrg: true,
            generalOrg: true,
            subOrg: true,
            designOrg: true,
          },
        },
        createdBy: true,
        location: true,
        workItem: true,
        signatures: {
          include: { person: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!document || document.deletedAt) {
      return res.status(404).json({ error: 'Документ не найден' });
    }

    if (!document.template) {
      return res.status(400).json({ error: 'Документу не назначен шаблон для генерации' });
    }

    // Build template data map
    const templateData: Record<string, any> = {
      // Project data
      projectName: document.project.name,
      projectCode: document.project.code,
      projectAddress: document.project.address || '',
      contractNumber: document.project.contractNumber || '',
      contractDate: document.project.contractDate?.toLocaleDateString('ru-RU') || '',
      // Organizations
      clientOrg: document.project.clientOrg?.name || '',
      generalOrg: document.project.generalOrg?.name || '',
      subOrg: document.project.subOrg?.name || '',
      designOrg: document.project.designOrg?.name || '',
      // Document data
      documentNumber: document.documentNumber || '',
      documentDate: document.documentDate.toLocaleDateString('ru-RU'),
      documentTitle: document.title,
      revision: document.revision,
      // Location
      locationName: document.location?.name || '',
      // Work item
      workItemCode: document.workItem?.code || '',
      workItemName: document.workItem?.name || '',
      // Author
      createdByFio: document.createdBy.fio,
      createdByPosition: document.createdBy.position || '',
      // Custom form data
      ...(document.data as Record<string, any> || {}),
    };

    // Add signature data
    document.signatures.forEach((sig, idx) => {
      templateData[`signer_${idx + 1}_fio`] = sig.person.fio;
      templateData[`signer_${idx + 1}_position`] = sig.person.position || '';
      templateData[`signer_${idx + 1}_role`] = sig.signRole;
      templateData[`signer_${idx + 1}_date`] = sig.signedAt?.toLocaleDateString('ru-RU') || '';
    });

    // For now, store the template data as a generation request
    // Full document generation with docx templating can be implemented in a service
    const updatedDoc = await prisma.document.update({
      where: { id: req.params.id },
      data: {
        data: templateData,
        fileName: `${document.documentType}_${document.documentNumber || document.id}.docx`,
      },
    });

    return res.json({
      message: 'Данные для генерации подготовлены',
      document: updatedDoc,
      templateData,
    });
  } catch (error) {
    console.error('Generate document error:', error);
    return res.status(500).json({ error: 'Ошибка при генерации документа' });
  }
});

export default router;

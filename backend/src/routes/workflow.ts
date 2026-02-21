import { Router, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Valid status transitions map
const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['IN_REVIEW'],
  IN_REVIEW: ['REVISION_REQUESTED', 'PENDING_SIGNATURE'],
  REVISION_REQUESTED: ['IN_REVIEW', 'DRAFT'],
  PENDING_SIGNATURE: ['SIGNED', 'REVISION_REQUESTED'],
  SIGNED: ['IN_PACKAGE', 'ARCHIVED'],
  IN_PACKAGE: ['ARCHIVED'],
  ARCHIVED: [],
};

// ─── GET /api/workflow/transitions?documentId=... ───
router.get('/transitions', async (req: AuthRequest, res: Response) => {
  try {
    const { documentId, page = '1', limit = '50' } = req.query;

    if (!documentId) {
      return res.status(400).json({ error: 'Обязательный параметр: documentId' });
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [transitions, total] = await Promise.all([
      prisma.workflowTransition.findMany({
        where: { documentId: documentId as string },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          performedBy: { select: { id: true, fio: true, position: true } },
          document: { select: { id: true, title: true, documentNumber: true } },
        },
      }),
      prisma.workflowTransition.count({ where: { documentId: documentId as string } }),
    ]);

    return res.json({ data: transitions, total, page: parseInt(page as string), limit: take });
  } catch (error) {
    console.error('List transitions error:', error);
    return res.status(500).json({ error: 'Ошибка при получении истории переходов' });
  }
});

// ─── GET /api/workflow/available-transitions/:documentId ───
router.get('/available-transitions/:documentId', async (req: AuthRequest, res: Response) => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.documentId },
      select: { id: true, status: true, title: true, lockedAt: true },
    });

    if (!document) {
      return res.status(404).json({ error: 'Документ не найден' });
    }

    const available = VALID_TRANSITIONS[document.status] || [];

    return res.json({
      documentId: document.id,
      currentStatus: document.status,
      availableTransitions: available,
      isLocked: !!document.lockedAt,
    });
  } catch (error) {
    console.error('Get available transitions error:', error);
    return res.status(500).json({ error: 'Ошибка при получении доступных переходов' });
  }
});

// ─── POST /api/workflow/transition ───
router.post('/transition', async (req: AuthRequest, res: Response) => {
  try {
    const { documentId, toStatus, comment, changedFields } = req.body;

    if (!documentId || !toStatus) {
      return res.status(400).json({ error: 'Обязательные поля: documentId, toStatus' });
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        signatures: { where: { status: 'PENDING' } },
      },
    });

    if (!document || document.deletedAt) {
      return res.status(404).json({ error: 'Документ не найден' });
    }

    if (document.lockedAt && toStatus !== 'ARCHIVED' && toStatus !== 'IN_PACKAGE') {
      return res.status(400).json({ error: 'Документ заблокирован после подписания' });
    }

    const validNext = VALID_TRANSITIONS[document.status] || [];
    if (!validNext.includes(toStatus)) {
      return res.status(400).json({
        error: `Невозможно перейти из статуса "${document.status}" в "${toStatus}". Допустимые переходы: ${validNext.join(', ') || 'нет'}`,
      });
    }

    // Validate specific transitions
    if (toStatus === 'PENDING_SIGNATURE') {
      const sigCount = await prisma.documentSignature.count({ where: { documentId } });
      if (sigCount === 0) {
        return res.status(400).json({ error: 'Для отправки на подпись необходимо добавить подписантов' });
      }
    }

    if (toStatus === 'REVISION_REQUESTED' && !comment) {
      return res.status(400).json({ error: 'Укажите причину возврата на доработку (comment)' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create transition record
      const transition = await tx.workflowTransition.create({
        data: {
          documentId,
          fromStatus: document.status,
          toStatus,
          performedById: req.userId!,
          comment: comment || null,
          changedFields: changedFields || null,
        },
        include: {
          performedBy: { select: { id: true, fio: true, position: true } },
        },
      });

      // Update document status
      const updateData: any = { status: toStatus };

      // Lock document when signed
      if (toStatus === 'SIGNED') {
        updateData.lockedAt = new Date();
      }

      // Reset signatures if returned for revision
      if (toStatus === 'REVISION_REQUESTED') {
        await tx.documentSignature.updateMany({
          where: { documentId, status: 'PENDING' },
          data: { status: 'PENDING' },
        });
        // Unlock for editing
        updateData.lockedAt = null;
      }

      // Reset pending signatures if going back to draft
      if (toStatus === 'DRAFT') {
        await tx.documentSignature.updateMany({
          where: { documentId },
          data: { status: 'PENDING', signedAt: null, comment: null, stampData: undefined },
        });
        updateData.lockedAt = null;
      }

      await tx.document.update({
        where: { id: documentId },
        data: updateData,
      });

      return transition;
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Workflow transition error:', error);
    return res.status(500).json({ error: 'Ошибка при переходе по рабочему процессу' });
  }
});

// ─── POST /api/workflow/bulk-transition ───
router.post('/bulk-transition', async (req: AuthRequest, res: Response) => {
  try {
    const { documentIds, toStatus, comment } = req.body;

    if (!Array.isArray(documentIds) || documentIds.length === 0 || !toStatus) {
      return res.status(400).json({ error: 'Обязательные поля: documentIds (массив), toStatus' });
    }

    if (documentIds.length > 50) {
      return res.status(400).json({ error: 'Максимум 50 документов за одну операцию' });
    }

    const results: { documentId: string; success: boolean; error?: string }[] = [];

    for (const docId of documentIds) {
      try {
        const document = await prisma.document.findUnique({ where: { id: docId } });
        if (!document || document.deletedAt) {
          results.push({ documentId: docId, success: false, error: 'Документ не найден' });
          continue;
        }

        const validNext = VALID_TRANSITIONS[document.status] || [];
        if (!validNext.includes(toStatus)) {
          results.push({
            documentId: docId,
            success: false,
            error: `Невозможно перейти из "${document.status}" в "${toStatus}"`,
          });
          continue;
        }

        await prisma.$transaction(async (tx) => {
          await tx.workflowTransition.create({
            data: {
              documentId: docId,
              fromStatus: document.status,
              toStatus,
              performedById: req.userId!,
              comment: comment || null,
            },
          });

          const updateData: any = { status: toStatus };
          if (toStatus === 'SIGNED') updateData.lockedAt = new Date();
          if (['REVISION_REQUESTED', 'DRAFT'].includes(toStatus)) updateData.lockedAt = null;

          await tx.document.update({ where: { id: docId }, data: updateData });
        });

        results.push({ documentId: docId, success: true });
      } catch (err) {
        results.push({ documentId: docId, success: false, error: 'Внутренняя ошибка' });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return res.json({
      message: `Обработано: ${successCount} успешно, ${failCount} с ошибками`,
      results,
    });
  } catch (error) {
    console.error('Bulk transition error:', error);
    return res.status(500).json({ error: 'Ошибка при массовом переходе по рабочему процессу' });
  }
});

export default router;

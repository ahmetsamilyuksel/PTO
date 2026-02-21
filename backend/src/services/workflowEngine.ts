import { DocumentStatus } from '@prisma/client';
import { prisma } from '../index';

// ─── Допустимые переходы статусов документа ───
const ALLOWED_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  [DocumentStatus.DRAFT]: [DocumentStatus.IN_REVIEW],
  [DocumentStatus.IN_REVIEW]: [
    DocumentStatus.REVISION_REQUESTED,
    DocumentStatus.PENDING_SIGNATURE,
  ],
  [DocumentStatus.REVISION_REQUESTED]: [DocumentStatus.IN_REVIEW],
  [DocumentStatus.PENDING_SIGNATURE]: [
    DocumentStatus.SIGNED,
    DocumentStatus.REVISION_REQUESTED,
  ],
  [DocumentStatus.SIGNED]: [
    DocumentStatus.ARCHIVED,
    DocumentStatus.IN_PACKAGE,
  ],
  [DocumentStatus.ARCHIVED]: [],
  [DocumentStatus.IN_PACKAGE]: [],
};

/**
 * Возвращает список допустимых переходов из текущего статуса.
 */
export function getAllowedTransitions(
  currentStatus: DocumentStatus
): DocumentStatus[] {
  return ALLOWED_TRANSITIONS[currentStatus] ?? [];
}

/**
 * Проверяет, допустим ли переход между статусами.
 */
export function isTransitionAllowed(
  fromStatus: DocumentStatus,
  toStatus: DocumentStatus
): boolean {
  const allowed = ALLOWED_TRANSITIONS[fromStatus];
  return allowed ? allowed.includes(toStatus) : false;
}

/**
 * Выполняет переход документа в новый статус.
 *
 * 1. Загружает текущий документ
 * 2. Проверяет, что переход допустим
 * 3. Создаёт запись WorkflowTransition
 * 4. Обновляет статус документа
 * 5. Возвращает обновлённый документ
 *
 * @param documentId - ID документа
 * @param toStatus - Целевой статус
 * @param performedById - ID пользователя, выполняющего переход
 * @param comment - Необязательный комментарий к переходу
 * @returns Обновлённый документ
 */
export async function transitionDocument(
  documentId: string,
  toStatus: DocumentStatus,
  performedById: string,
  comment?: string
) {
  // 1. Загружаем документ
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      signatures: true,
      attachments: true,
    },
  });

  if (!document) {
    throw new Error(`Документ с ID "${documentId}" не найден`);
  }

  if (document.deletedAt) {
    throw new Error(`Документ "${document.title}" удалён и не может быть изменён`);
  }

  const fromStatus = document.status;

  // 2. Проверяем допустимость перехода
  if (!isTransitionAllowed(fromStatus, toStatus)) {
    const allowedList = getAllowedTransitions(fromStatus).join(', ') || 'нет доступных переходов';
    throw new Error(
      `Недопустимый переход статуса: ${fromStatus} → ${toStatus}. ` +
      `Допустимые переходы из "${fromStatus}": ${allowedList}`
    );
  }

  // 3. Дополнительные проверки в зависимости от перехода
  if (toStatus === DocumentStatus.PENDING_SIGNATURE) {
    // При переходе на подписание проверяем наличие хотя бы одной подписи
    if (document.signatures.length === 0) {
      throw new Error(
        'Невозможно отправить на подписание: не назначены подписанты'
      );
    }
  }

  if (toStatus === DocumentStatus.SIGNED) {
    // При переходе в «Подписан» проверяем, что все подписи собраны
    const pendingSignatures = document.signatures.filter(
      (s) => s.status === 'PENDING'
    );
    if (pendingSignatures.length > 0) {
      throw new Error(
        `Невозможно завершить подписание: ${pendingSignatures.length} подпись(ей) ожидает(ют)`
      );
    }
  }

  // 4. Выполняем переход в транзакции
  const [transition, updatedDocument] = await prisma.$transaction([
    // Создаём запись перехода
    prisma.workflowTransition.create({
      data: {
        documentId,
        fromStatus,
        toStatus,
        performedById,
        comment: comment ?? null,
      },
    }),
    // Обновляем статус документа
    prisma.document.update({
      where: { id: documentId },
      data: {
        status: toStatus,
        // При подписании блокируем документ
        ...(toStatus === DocumentStatus.SIGNED
          ? { lockedAt: new Date() }
          : {}),
      },
      include: {
        project: true,
        location: true,
        workItem: true,
        signatures: {
          include: { person: true },
        },
        attachments: true,
        createdBy: true,
      },
    }),
  ]);

  return updatedDocument;
}

/**
 * Возвращает полную историю переходов документа.
 */
export async function getDocumentWorkflowHistory(documentId: string) {
  return prisma.workflowTransition.findMany({
    where: { documentId },
    include: {
      performedBy: {
        select: {
          id: true,
          fio: true,
          position: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Массовый переход документов (например, все SIGNED → IN_PACKAGE при формировании комплекта).
 */
export async function bulkTransitionDocuments(
  documentIds: string[],
  toStatus: DocumentStatus,
  performedById: string,
  comment?: string
): Promise<{ succeeded: string[]; failed: Array<{ id: string; error: string }> }> {
  const succeeded: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const docId of documentIds) {
    try {
      await transitionDocument(docId, toStatus, performedById, comment);
      succeeded.push(docId);
    } catch (err) {
      failed.push({
        id: docId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { succeeded, failed };
}

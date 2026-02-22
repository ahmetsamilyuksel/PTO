import { DocumentType, DocumentStatus } from '@prisma/client';
import { prisma } from '../index';
import { DEFAULT_MATRIX_RULES, MatrixRuleDefinition } from './documentMatrix';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Полная валидация документа перед отправкой на подписание.
 *
 * Проверяет:
 * 1. Заполненность обязательных полей в data JSON
 * 2. Наличие обязательных вложений (сертификаты, фото, протоколы)
 * 3. Корректность дат (нет будущих дат, логический порядок)
 * 4. Наличие связанных документов
 * 5. Уникальность акта для зоны + тип (предупреждение)
 * 6. Наличие сертификатов на материалы
 */
export async function validateDocumentForSignature(
  documentId: string
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Загружаем документ со всеми связями
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      attachments: true,
      workItem: {
        include: {
          materialUsages: {
            include: {
              material: {
                include: {
                  certificates: true,
                },
              },
            },
          },
        },
      },
      location: true,
      signatures: true,
      project: true,
    },
  });

  if (!document) {
    return { valid: false, errors: ['Document not found'], warnings: [] };
  }

  if (document.deletedAt) {
    return { valid: false, errors: ['Document is deleted'], warnings: [] };
  }

  // ─── Проверка статуса ───
  if (
    document.status !== DocumentStatus.IN_REVIEW &&
    document.status !== DocumentStatus.DRAFT
  ) {
    warnings.push(
      `Document is in status "${document.status}", expected "IN_REVIEW" or "DRAFT"`
    );
  }

  // ─── 1. Обязательные поля в data JSON ───
  validateRequiredFields(document.documentType, document.data, errors);

  // ─── 2. Обязательные вложения по матрице ───
  validateRequiredAttachments(document, errors, warnings);

  // ─── 3. Проверка дат ───
  validateDates(document.data, document.documentDate, errors, warnings);

  // ─── 4. Связанные документы ───
  await validateLinkedDocuments(document, errors, warnings);

  // ─── 5. Уникальность акта зона+тип ───
  await validateNoDuplicateAct(document, warnings);

  // ─── 6. Сертификаты на материалы ───
  validateMaterialCertificates(document, errors, warnings);

  // ─── 7. Подписанты ───
  if (document.signatures.length === 0) {
    errors.push('No signatories assigned to document');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ═══════════════════════════════════════════════════════════
// Вспомогательные функции валидации
// ═══════════════════════════════════════════════════════════

/**
 * Проверяет заполненность обязательных полей в data JSON
 * в зависимости от типа документа.
 */
function validateRequiredFields(
  docType: DocumentType,
  data: unknown,
  errors: string[]
): void {
  if (!data || typeof data !== 'object') {
    errors.push('Missing document data (field: data)');
    return;
  }

  const dataObj = data as Record<string, unknown>;

  // Общие обязательные поля для всех документов
  const commonRequired: string[] = [];

  // Специфичные обязательные поля по типу
  const typeRequiredFields: Partial<Record<DocumentType, string[]>> = {
    [DocumentType.AOSR]: [
      'actNumber',
      'workDescription',
      'startDate',
      'endDate',
      'projectDocumentation',
      'materials',
      'nextWorkDescription',
    ],
    [DocumentType.AOOK]: [
      'actNumber',
      'constructionDescription',
      'projectDocumentation',
      'results',
    ],
    [DocumentType.NETWORK_ACT]: [
      'actNumber',
      'networkDescription',
      'startDate',
      'endDate',
      'testResults',
    ],
    [DocumentType.TEST_PROTOCOL]: [
      'protocolNumber',
      'testType',
      'testDate',
      'results',
      'passed',
    ],
    [DocumentType.GEODETIC_ACT]: [
      'actNumber',
      'surveyDate',
      'deviations',
    ],
    [DocumentType.EXECUTIVE_DRAWING]: [
      'drawingNumber',
      'drawingDescription',
    ],
    [DocumentType.INCOMING_CONTROL_ACT]: [
      'actNumber',
      'materialName',
      'controlDate',
      'result',
    ],
  };

  const requiredFields = [
    ...commonRequired,
    ...(typeRequiredFields[docType] ?? []),
  ];

  for (const field of requiredFields) {
    const value = dataObj[field];
    if (value === undefined || value === null || value === '') {
      errors.push(`Required field not filled: "${field}"`);
    }
  }
}

/**
 * Проверяет наличие обязательных вложений по матрице документов.
 */
function validateRequiredAttachments(
  document: {
    documentType: DocumentType;
    attachments: Array<{ category: string; fileName: string }>;
    workItem?: { workType: string } | null;
  },
  errors: string[],
  warnings: string[]
): void {
  // Ищем правило матрицы для данного типа документа
  let matchingRule: MatrixRuleDefinition | undefined;

  if (document.workItem) {
    matchingRule = DEFAULT_MATRIX_RULES.find(
      (r) =>
        r.documentType === document.documentType &&
        r.workType === document.workItem!.workType
    );
  }

  if (!matchingRule) {
    // Если правило не найдено, просто ищем по типу документа
    matchingRule = DEFAULT_MATRIX_RULES.find(
      (r) => r.documentType === document.documentType
    );
  }

  if (!matchingRule) {
    return; // Нет правила — нечего проверять
  }

  const attachmentNames = document.attachments.map((a) =>
    a.fileName.toLowerCase()
  );
  const attachmentCategories = document.attachments.map((a) => a.category);

  for (const required of matchingRule.requiredAttachments) {
    const requiredLower = required.toLowerCase();

    // Проверяем наличие вложения по ключевым словам
    const hasAttachment = checkAttachmentPresence(
      requiredLower,
      attachmentNames,
      attachmentCategories
    );

    if (!hasAttachment) {
      // Фото и исполнительные схемы — предупреждения, остальное — ошибки
      if (
        requiredLower.includes('фото') ||
        requiredLower.includes('при наличии')
      ) {
        warnings.push(`Recommended to attach: ${required}`);
      } else {
        errors.push(`Required attachment missing: ${required}`);
      }
    }
  }
}

/**
 * Проверяет наличие вложения по ключевым словам.
 */
function checkAttachmentPresence(
  requiredLower: string,
  fileNames: string[],
  categories: string[]
): boolean {
  // Маппинг ключевых слов к категориям вложений
  const keywordCategoryMap: Array<{ keywords: string[]; category: string }> = [
    { keywords: ['сертификат', 'паспорт'], category: 'CERTIFICATE' },
    { keywords: ['протокол', 'испытан'], category: 'PROTOCOL' },
    { keywords: ['фото'], category: 'PHOTO' },
    { keywords: ['схема', 'чертёж', 'чертеж'], category: 'SCHEME' },
    { keywords: ['исполнительная'], category: 'DRAWING' },
  ];

  // Проверяем по категории
  for (const mapping of keywordCategoryMap) {
    if (mapping.keywords.some((kw) => requiredLower.includes(kw))) {
      if (categories.includes(mapping.category)) {
        return true;
      }
    }
  }

  // Проверяем по имени файла
  const keywords = requiredLower
    .split(/[\s/,()]+/)
    .filter((w) => w.length > 3);
  return fileNames.some((fn) =>
    keywords.some((kw) => fn.includes(kw))
  );
}

/**
 * Проверяет корректность дат:
 * - Нет будущих дат
 * - Даты в логическом порядке (startDate <= endDate)
 */
function validateDates(
  data: unknown,
  documentDate: Date,
  errors: string[],
  warnings: string[]
): void {
  const now = new Date();
  now.setHours(23, 59, 59, 999); // Конец текущего дня

  // Проверяем дату документа
  if (documentDate > now) {
    errors.push(
      `Document date (${documentDate.toISOString().slice(0, 10)}) cannot be in the future`
    );
  }

  if (!data || typeof data !== 'object') return;
  const dataObj = data as Record<string, unknown>;

  // Проверяем все поля, содержащие "date" / "Date"
  const dateFields = Object.entries(dataObj).filter(
    ([key]) =>
      key.toLowerCase().includes('date') ||
      key.toLowerCase().includes('дата')
  );

  for (const [key, value] of dateFields) {
    if (!value) continue;
    const dateVal = new Date(String(value));
    if (isNaN(dateVal.getTime())) continue;

    if (dateVal > now) {
      errors.push(
        `Field "${key}" contains a future date: ${dateVal.toISOString().slice(0, 10)}`
      );
    }
  }

  // Проверяем логический порядок startDate <= endDate
  const startDate = dataObj['startDate'] || dataObj['dateStart'] || dataObj['начало'];
  const endDate = dataObj['endDate'] || dataObj['dateEnd'] || dataObj['окончание'];

  if (startDate && endDate) {
    const start = new Date(String(startDate));
    const end = new Date(String(endDate));
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start > end) {
      errors.push(
        `Start date (${start.toISOString().slice(0, 10)}) is after end date (${end.toISOString().slice(0, 10)})`
      );
    }
  }
}

/**
 * Проверяет наличие связанных документов.
 */
async function validateLinkedDocuments(
  document: {
    id: string;
    documentType: DocumentType;
    data: unknown;
    projectId: string;
  },
  errors: string[],
  _warnings: string[]
): Promise<void> {
  if (!document.data || typeof document.data !== 'object') return;
  const dataObj = document.data as Record<string, unknown>;

  // Проверяем ссылки на другие документы в data
  const refFields = Object.entries(dataObj).filter(
    ([key]) =>
      key.toLowerCase().includes('documentid') ||
      key.toLowerCase().includes('documentref') ||
      key.toLowerCase().includes('linkedDoc') ||
      key.toLowerCase().includes('referencedoc')
  );

  for (const [key, value] of refFields) {
    if (!value || typeof value !== 'string') continue;

    const referencedDoc = await prisma.document.findUnique({
      where: { id: value },
      select: { id: true, status: true, deletedAt: true },
    });

    if (!referencedDoc) {
      errors.push(
        `Reference to non-existent document in field "${key}": ${value}`
      );
    } else if (referencedDoc.deletedAt) {
      errors.push(
        `Reference to deleted document in field "${key}": ${value}`
      );
    }
  }

  // Для АОСР проверяем, что есть ссылка на ИД/ПД
  if (document.documentType === DocumentType.AOSR) {
    const hasProjectDoc =
      dataObj['projectDocumentation'] ||
      dataObj['projectDocRef'] ||
      dataObj['pdRef'];
    if (!hasProjectDoc) {
      errors.push(
        'AOSR must contain a reference to project documentation (projectDocumentation)'
      );
    }
  }
}

/**
 * Проверяет, нет ли дубликата акта для той же зоны и типа работ.
 * Выдаёт предупреждение (не ошибку).
 */
async function validateNoDuplicateAct(
  document: {
    id: string;
    documentType: DocumentType;
    locationId?: string | null;
    workItemId?: string | null;
    projectId: string;
  },
  warnings: string[]
): Promise<void> {
  // Проверяем только для актов скрытых/ответственных/сетей
  const actTypes: DocumentType[] = [
    DocumentType.AOSR,
    DocumentType.AOOK,
    DocumentType.NETWORK_ACT,
  ];

  if (!actTypes.includes(document.documentType)) return;
  if (!document.locationId && !document.workItemId) return;

  const whereClause: Record<string, unknown> = {
    id: { not: document.id },
    projectId: document.projectId,
    documentType: document.documentType,
    deletedAt: null,
    status: {
      notIn: [DocumentStatus.DRAFT, DocumentStatus.REVISION_REQUESTED],
    },
  };

  if (document.locationId) {
    whereClause['locationId'] = document.locationId;
  }
  if (document.workItemId) {
    whereClause['workItemId'] = document.workItemId;
  }

  const duplicates = await prisma.document.findMany({
    where: whereClause,
    select: {
      id: true,
      documentNumber: true,
      title: true,
      status: true,
    },
  });

  if (duplicates.length > 0) {
    const dupInfo = duplicates
      .map(
        (d) =>
          `${d.documentNumber ?? d.id} (${d.status})`
      )
      .join(', ');
    warnings.push(
      `Similar acts found for the same zone/work: ${dupInfo}. ` +
      'Make sure this is not a duplicate.'
    );
  }
}

/**
 * Проверяет наличие сертификатов на материалы,
 * если документ ссылается на материалы через WorkItem.
 */
function validateMaterialCertificates(
  document: {
    documentType: DocumentType;
    workItem?: {
      materialUsages: Array<{
        material: {
          name: string;
          certificates: Array<{ id: string }>;
        };
      }>;
    } | null;
  },
  errors: string[],
  warnings: string[]
): void {
  // Проверяем только для актов, требующих указания материалов
  const docTypesWithMaterials: DocumentType[] = [
    DocumentType.AOSR,
    DocumentType.AOOK,
    DocumentType.NETWORK_ACT,
  ];

  if (!docTypesWithMaterials.includes(document.documentType)) return;
  if (!document.workItem) return;

  const usages = document.workItem.materialUsages;
  if (usages.length === 0) {
    warnings.push(
      'No materials specified for this type of work'
    );
    return;
  }

  for (const usage of usages) {
    if (usage.material.certificates.length === 0) {
      errors.push(
        `Material "${usage.material.name}" has no quality certificates/passports`
      );
    }
  }
}

/**
 * Быстрая проверка — можно ли отправить документ на подписание.
 * Возвращает true/false без деталей.
 */
export async function canSubmitForSignature(
  documentId: string
): Promise<boolean> {
  const result = await validateDocumentForSignature(documentId);
  return result.valid;
}

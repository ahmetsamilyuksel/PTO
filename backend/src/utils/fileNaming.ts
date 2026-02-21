import { DocumentType } from '@prisma/client';

// ─── Маппинг DocumentType → русское сокращение для имени файла ───
const DOC_TYPE_PREFIX: Record<DocumentType, string> = {
  [DocumentType.SITE_HANDOVER]: 'Акт_передачи_площадки',
  [DocumentType.ASSIGNMENT_ORDER]: 'Приказ_назначение',
  [DocumentType.HSE_BRIEFING]: 'Журнал_инструктажей',
  [DocumentType.PPR_UPLOAD]: 'ППР',
  [DocumentType.KICKOFF_PROTOCOL]: 'Протокол_стартового',
  [DocumentType.AOSR]: 'АОСР',
  [DocumentType.AOOK]: 'АООК',
  [DocumentType.NETWORK_ACT]: 'Акт_сети',
  [DocumentType.GEODETIC_ACT]: 'Акт_геодезия',
  [DocumentType.EXECUTIVE_DRAWING]: 'Исп_схема',
  [DocumentType.INCOMING_CONTROL_ACT]: 'Акт_входной_контроль',
  [DocumentType.MATERIAL_CERTIFICATE]: 'Сертификат_материал',
  [DocumentType.TEST_PROTOCOL]: 'Протокол_испытаний',
  [DocumentType.INTERIM_ACCEPTANCE]: 'Акт_промежуточной',
  [DocumentType.DEFECT_LIST]: 'Дефектная_ведомость',
  [DocumentType.COMPLETION_ACT]: 'Акт_приёмки',
  [DocumentType.ID_HANDOVER]: 'Акт_передачи_ИД',
  [DocumentType.CORRESPONDENCE]: 'Письмо',
  [DocumentType.OTHER]: 'Документ',
};

// ─── Маппинг DocumentType → папка в комплекте ───
const DOC_TYPE_FOLDER: Record<DocumentType, string> = {
  [DocumentType.SITE_HANDOVER]: '00_Сводные',
  [DocumentType.ASSIGNMENT_ORDER]: '00_Сводные',
  [DocumentType.HSE_BRIEFING]: '00_Сводные',
  [DocumentType.PPR_UPLOAD]: '00_Сводные',
  [DocumentType.KICKOFF_PROTOCOL]: '00_Сводные',
  [DocumentType.AOSR]: '02_Акты_скрытых',
  [DocumentType.AOOK]: '03_Акты_ответственных',
  [DocumentType.NETWORK_ACT]: '04_Сети_инженерные',
  [DocumentType.GEODETIC_ACT]: '05_Исполнительные_схемы',
  [DocumentType.EXECUTIVE_DRAWING]: '05_Исполнительные_схемы',
  [DocumentType.INCOMING_CONTROL_ACT]: '06_Сертификаты_паспорта',
  [DocumentType.MATERIAL_CERTIFICATE]: '06_Сертификаты_паспорта',
  [DocumentType.TEST_PROTOCOL]: '07_Протоколы_испытаний',
  [DocumentType.INTERIM_ACCEPTANCE]: '00_Сводные',
  [DocumentType.DEFECT_LIST]: '00_Сводные',
  [DocumentType.COMPLETION_ACT]: '00_Сводные',
  [DocumentType.ID_HANDOVER]: '00_Сводные',
  [DocumentType.CORRESPONDENCE]: '08_Переписка_письма',
  [DocumentType.OTHER]: '00_Сводные',
};

/**
 * Генерирует детерминированное имя файла документа на русском языке.
 *
 * Формат: {ТипДок}_Zone-{зона}_Работа-{описание}_{дата}_Rev{NN}.{ext}
 * Пример: АОСР_Zone-Блок_А_Работа-Бетон_2024-01-15_Rev01.pdf
 *
 * @param docType - Тип документа
 * @param zone - Наименование зоны/локации
 * @param workDesc - Краткое описание работ
 * @param date - Дата документа
 * @param revision - Номер ревизии
 * @param extension - Расширение файла (по умолчанию 'pdf')
 * @returns Имя файла
 */
export function generateDocumentFileName(
  docType: DocumentType,
  zone: string,
  workDesc: string,
  date: Date,
  revision: number,
  extension: string = 'pdf'
): string {
  const prefix = DOC_TYPE_PREFIX[docType] || 'Документ';
  const sanitizedZone = sanitizeForFileName(zone);
  const sanitizedWork = sanitizeForFileName(workDesc);
  const dateStr = formatDateForFileName(date);
  const revStr = `Rev${String(revision).padStart(2, '0')}`;

  return `${prefix}_Zone-${sanitizedZone}_Работа-${sanitizedWork}_${dateStr}_${revStr}.${extension}`;
}

/**
 * Генерирует JSON-строку с данными для QR-кода документа.
 *
 * @param documentId - ID документа в БД
 * @param revision - Номер ревизии
 * @returns JSON-строка с данными для QR-кода
 */
export function generateQRData(
  documentId: string,
  revision: number
): string {
  const qrData = {
    system: 'ПТО DocOps',
    docId: documentId,
    rev: revision,
    ts: new Date().toISOString(),
    verify: `https://pto.example.com/verify/${documentId}?rev=${revision}`,
  };

  return JSON.stringify(qrData);
}

/**
 * Возвращает папку комплекта для данного типа документа.
 *
 * @param docType - Тип документа
 * @returns Имя папки в комплекте ИД
 */
export function getPackageFolderForDocType(docType: DocumentType): string {
  return DOC_TYPE_FOLDER[docType] || '00_Сводные';
}

/**
 * Возвращает русское сокращение типа документа.
 */
export function getDocTypePrefix(docType: DocumentType): string {
  return DOC_TYPE_PREFIX[docType] || 'Документ';
}

// ─── Вспомогательные функции ───

/**
 * Очищает строку для использования в имени файла:
 * - Заменяет пробелы на подчёркивания
 * - Убирает спецсимволы, запрещённые в именах файлов
 * - Обрезает до 50 символов
 */
function sanitizeForFileName(input: string): string {
  return input
    .trim()
    .replace(/[\s]+/g, '_')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/[.]+/g, '_')
    .substring(0, 50);
}

/**
 * Форматирует дату для имени файла в формате YYYY-MM-DD.
 */
function formatDateForFileName(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

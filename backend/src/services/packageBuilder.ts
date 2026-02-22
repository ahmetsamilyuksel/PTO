import archiver from 'archiver';
import { DocumentType, PackageStatus } from '@prisma/client';
import { prisma } from '../index';
import { downloadFile, uploadFile } from './storage';
import { getPackageFolderForDocType } from '../utils/fileNaming';

// ─── Структура папок комплекта ИД ───
export const PACKAGE_FOLDER_STRUCTURE = [
  '00_Сводные',
  '01_Журналы',
  '02_Акты_скрытых',
  '03_Акты_ответственных',
  '04_Сети_инженерные',
  '05_Исполнительные_схемы',
  '06_Сертификаты_паспорта',
  '07_Протоколы_испытаний',
  '08_Переписка_письма',
] as const;

/**
 * Собирает комплект документов в ZIP-файл.
 *
 * 1. Загружает все документы комплекта из БД
 * 2. Скачивает файлы каждого документа из MinIO
 * 3. Раскладывает по папкам согласно типу документа
 * 4. Генерирует опись (реестр документов)
 * 5. Архивирует в ZIP
 * 6. Загружает ZIP в MinIO
 * 7. Обновляет запись Package
 *
 * @param packageId - ID комплекта в БД
 */
export async function buildPackage(packageId: string): Promise<{
  filePath: string;
  opisPath: string;
  fileSize: number;
  documentCount: number;
}> {
  // 1. Загружаем комплект с элементами
  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
    include: {
      project: true,
      items: {
        include: {
          document: {
            include: {
              location: true,
              workItem: true,
              attachments: true,
              signatures: {
                include: { person: true },
              },
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!pkg) {
    throw new Error(`Package with ID "${packageId}" not found`);
  }

  if (pkg.items.length === 0) {
    throw new Error('Package contains no documents');
  }

  // Устанавливаем статус GENERATING
  await prisma.package.update({
    where: { id: packageId },
    data: { status: PackageStatus.GENERATING },
  });

  try {
    // 2. Собираем ZIP
    const { zipBuffer, opisContent } = await createZipArchive(pkg);

    // 3. Загружаем ZIP и опись в MinIO
    const projectCode = pkg.project.code;
    const timestamp = new Date().toISOString().slice(0, 10);
    const zipObjectName = `packages/${projectCode}/${pkg.name}_${timestamp}.zip`;
    const opisObjectName = `packages/${projectCode}/${pkg.name}_${timestamp}_опись.csv`;

    const opisBuffer = Buffer.from(opisContent, 'utf-8');

    await uploadFile(zipObjectName, zipBuffer, 'application/zip');
    await uploadFile(opisObjectName, opisBuffer, 'text/csv; charset=utf-8');

    // 4. Обновляем запись комплекта
    await prisma.package.update({
      where: { id: packageId },
      data: {
        status: PackageStatus.READY,
        filePath: zipObjectName,
        opisPath: opisObjectName,
      },
    });

    return {
      filePath: zipObjectName,
      opisPath: opisObjectName,
      fileSize: zipBuffer.length,
      documentCount: pkg.items.length,
    };
  } catch (err) {
    // При ошибке возвращаем статус в DRAFT
    await prisma.package.update({
      where: { id: packageId },
      data: { status: PackageStatus.DRAFT },
    });
    throw err;
  }
}

/**
 * Создаёт ZIP-архив из документов комплекта.
 */
async function createZipArchive(
  pkg: Awaited<ReturnType<typeof loadPackageWithItems>>
): Promise<{ zipBuffer: Buffer; opisContent: string }> {
  return new Promise(async (resolve, reject) => {
    const archive = archiver('zip', {
      zlib: { level: 6 },
    });

    const chunks: Buffer[] = [];
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('error', (err: Error) => reject(err));

    // Опись (реестр документов)
    const opisRows: string[][] = [];
    opisRows.push([
      '№ п/п',
      'Наименование документа',
      'Номер документа',
      'Дата',
      'Тип документа',
      'Зона/Локация',
      'Папка',
      'Статус',
      'Подписанты',
    ]);

    let itemIndex = 0;

    for (const item of pkg.items) {
      itemIndex++;
      const doc = item.document;
      const folder = getPackageFolderForDocType(doc.documentType);

      // Скачиваем основной файл документа
      if (doc.filePath) {
        try {
          const fileBuffer = await downloadFile(doc.filePath);
          const fileName = doc.fileName || `${doc.documentNumber || doc.id}.pdf`;
          archive.append(fileBuffer, { name: `${folder}/${fileName}` });
        } catch (err) {
          console.error(
            `[packageBuilder] Failed to download document file ${doc.id}: ${err}`
          );
          // Добавляем заметку об ошибке
          const errorNote = `File not found: ${doc.filePath}`;
          archive.append(Buffer.from(errorNote, 'utf-8'), {
            name: `${folder}/${doc.documentNumber || doc.id}_ФАЙЛ_НЕ_НАЙДЕН.txt`,
          });
        }
      }

      // Скачиваем вложения документа
      for (const attachment of doc.attachments) {
        if (attachment.filePath) {
          try {
            const attBuffer = await downloadFile(attachment.filePath);
            const attFolder = getAttachmentSubfolder(folder, attachment.category);
            archive.append(attBuffer, {
              name: `${attFolder}/${attachment.originalName}`,
            });
          } catch (err) {
            console.error(
              `[packageBuilder] Failed to download attachment ${attachment.id}: ${err}`
            );
          }
        }
      }

      // Собираем строку описи
      const signersStr = doc.signatures
        .filter((s) => s.status === 'SIGNED')
        .map((s) => `${s.person.fio} (${s.signRole})`)
        .join('; ');

      opisRows.push([
        String(itemIndex),
        doc.title,
        doc.documentNumber || '-',
        doc.documentDate.toISOString().slice(0, 10),
        doc.documentType,
        doc.location?.name || '-',
        folder,
        doc.status,
        signersStr || '-',
      ]);
    }

    // Генерируем CSV описи
    const opisContent = opisRows
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(';')
      )
      .join('\n');

    // Добавляем опись в архив
    archive.append(Buffer.from(opisContent, 'utf-8'), {
      name: '00_Сводные/Опись_документов.csv',
    });

    // Добавляем пустые папки для полноты структуры
    for (const folderName of PACKAGE_FOLDER_STRUCTURE) {
      archive.append('', { name: `${folderName}/.keep` });
    }

    archive.on('end', () => {
      const zipBuffer = Buffer.concat(chunks);
      resolve({ zipBuffer, opisContent });
    });

    archive.finalize();
  });
}

/**
 * Определяет подпапку для вложения внутри основной папки документа.
 */
function getAttachmentSubfolder(
  parentFolder: string,
  category: string
): string {
  switch (category) {
    case 'CERTIFICATE':
      return '06_Сертификаты_паспорта';
    case 'PROTOCOL':
      return '07_Протоколы_испытаний';
    case 'PHOTO':
      return `${parentFolder}/Фото`;
    case 'SCHEME':
    case 'DRAWING':
      return '05_Исполнительные_схемы';
    default:
      return `${parentFolder}/Приложения`;
  }
}

/**
 * Вспомогательная функция для типизации (Prisma include).
 * Используется только для типа в createZipArchive.
 */
async function loadPackageWithItems(packageId: string) {
  return prisma.package.findUniqueOrThrow({
    where: { id: packageId },
    include: {
      project: true,
      items: {
        include: {
          document: {
            include: {
              location: true,
              workItem: true,
              attachments: true,
              signatures: {
                include: { person: true },
              },
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
}

/**
 * Добавляет документы в комплект с автоматическим определением папок.
 */
export async function addDocumentsToPackage(
  packageId: string,
  documentIds: string[]
): Promise<number> {
  // Загружаем максимальный sortOrder
  const maxItem = await prisma.packageItem.findFirst({
    where: { packageId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });

  let nextOrder = (maxItem?.sortOrder ?? -1) + 1;
  let addedCount = 0;

  for (const documentId of documentIds) {
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, documentType: true },
    });

    if (!doc) continue;

    const folderPath = getPackageFolderForDocType(doc.documentType);

    try {
      await prisma.packageItem.create({
        data: {
          packageId,
          documentId,
          folderPath,
          sortOrder: nextOrder++,
        },
      });
      addedCount++;
    } catch {
      // Пропускаем дубликаты (unique constraint)
      continue;
    }
  }

  return addedCount;
}

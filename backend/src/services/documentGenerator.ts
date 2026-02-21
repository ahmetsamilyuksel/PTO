import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { prisma } from '../index';
import { downloadFile } from './storage';

/**
 * Сервис генерации документов из DOCX-шаблонов с помощью docxtemplater.
 *
 * Шаблоны хранятся в MinIO, их пути записаны в DocumentTemplate.
 * Подстановочные поля в шаблоне записываются как {field_name}.
 */

/**
 * Генерирует DOCX-документ из шаблона, подставляя данные в плейсхолдеры.
 *
 * @param templateId - ID записи DocumentTemplate в БД
 * @param data - Объект с ключами-плейсхолдерами и значениями для подстановки
 * @returns Buffer с содержимым сгенерированного DOCX-файла
 */
export async function generateDocument(
  templateId: string,
  data: Record<string, unknown>
): Promise<Buffer> {
  // 1. Загружаем запись шаблона
  const template = await prisma.documentTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw new Error(`Шаблон документа с ID "${templateId}" не найден`);
  }

  if (!template.filePath) {
    throw new Error(`У шаблона "${template.name}" отсутствует путь к файлу`);
  }

  // 2. Загружаем файл шаблона из MinIO
  let templateBuffer: Buffer;
  try {
    templateBuffer = await downloadFile(template.filePath);
  } catch (err) {
    throw new Error(
      `Не удалось загрузить файл шаблона "${template.filePath}": ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  // 3. Открываем архив и инициализируем docxtemplater
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    // Настройки парсера
    paragraphLoop: true,
    linebreaks: true,
    // Не бросать исключение при отсутствующих тегах — оставлять пустыми
    nullGetter() {
      return '';
    },
  });

  // 4. Подставляем данные
  try {
    doc.render(data);
  } catch (err) {
    const error = err as { properties?: { errors?: unknown[] }; message?: string };
    if (error.properties && error.properties.errors) {
      const errorMessages = (error.properties.errors as Array<{ message: string }>)
        .map((e) => e.message)
        .join('; ');
      throw new Error(`Ошибка рендеринга шаблона: ${errorMessages}`);
    }
    throw new Error(
      `Ошибка рендеринга шаблона: ${error.message ?? String(err)}`
    );
  }

  // 5. Генерируем итоговый буфер
  const outputBuffer = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });

  return outputBuffer as Buffer;
}

/**
 * Генерирует DOCX из шаблона, используя только сырой буфер шаблона (без БД).
 * Полезно для предпросмотра и тестирования.
 */
export async function generateDocumentFromBuffer(
  templateBuffer: Buffer,
  data: Record<string, unknown>
): Promise<Buffer> {
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter() {
      return '';
    },
  });

  doc.render(data);

  const outputBuffer = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });

  return outputBuffer as Buffer;
}

/**
 * Конвертирует DOCX-буфер в PDF.
 *
 * ЗАГЛУШКА: в текущей версии возвращает исходный DOCX-буфер.
 * Полноценная конвертация будет реализована через LibreOffice в Docker-контейнере:
 *   libreoffice --headless --convert-to pdf --outdir /tmp /tmp/input.docx
 *
 * Когда LibreOffice будет доступен, заменить реализацию на:
 *   import libre from 'libreoffice-convert';
 *   const util = require('util');
 *   const convertAsync = util.promisify(libre.convert);
 *   return convertAsync(docxBuffer, '.pdf', undefined);
 */
export async function convertToPdf(docxBuffer: Buffer): Promise<Buffer> {
  // TODO: Включить LibreOffice-конвертацию в Docker-окружении
  // const libre = require('libreoffice-convert');
  // const { promisify } = require('util');
  // const convertAsync = promisify(libre.convert);
  // return await convertAsync(docxBuffer, '.pdf', undefined);

  console.warn(
    '[documentGenerator] convertToPdf: LibreOffice не настроен, возвращается DOCX-буфер'
  );
  return docxBuffer;
}

/**
 * Полный цикл: генерация документа из шаблона + конвертация в PDF.
 */
export async function generateDocumentAsPdf(
  templateId: string,
  data: Record<string, unknown>
): Promise<{ docxBuffer: Buffer; pdfBuffer: Buffer }> {
  const docxBuffer = await generateDocument(templateId, data);
  const pdfBuffer = await convertToPdf(docxBuffer);
  return { docxBuffer, pdfBuffer };
}

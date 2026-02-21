import QRCode from 'qrcode';

/**
 * Генерирует QR-код из строки данных и возвращает PNG-буфер.
 *
 * @param data - Строка данных для кодирования в QR
 * @returns Buffer с PNG-изображением QR-кода
 */
export async function generateQRCodeBuffer(data: string): Promise<Buffer> {
  const buffer = await QRCode.toBuffer(data, {
    type: 'png',
    width: 200,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });

  return buffer;
}

/**
 * Генерирует QR-код как Data URL строку (base64 PNG).
 * Полезно для встраивания в HTML/PDF.
 *
 * @param data - Строка данных для кодирования
 * @returns Data URL строка (data:image/png;base64,...)
 */
export async function generateQRCodeDataURL(data: string): Promise<string> {
  return QRCode.toDataURL(data, {
    width: 200,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
}

/**
 * Генерирует QR-код как SVG-строку.
 *
 * @param data - Строка данных для кодирования
 * @returns SVG-строка
 */
export async function generateQRCodeSVG(data: string): Promise<string> {
  return QRCode.toString(data, {
    type: 'svg',
    width: 200,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
}

/**
 * Формирует объект «штампа» документа — информация для нанесения
 * на подписанный документ (QR-код + текстовые данные).
 *
 * @param docId - ID документа
 * @param rev - Номер ревизии
 * @param systemName - Название системы
 * @param date - Дата подписания
 * @returns Объект с данными штампа
 */
export function generateDocumentStamp(
  docId: string,
  rev: number,
  systemName: string,
  date: Date
): {
  qrData: string;
  stampText: string;
  documentId: string;
  revision: number;
  system: string;
  signedAt: string;
  verifyUrl: string;
} {
  const signedAt = date.toISOString();
  const verifyUrl = `https://pto.example.com/verify/${docId}?rev=${rev}`;

  const qrData = JSON.stringify({
    system: systemName,
    docId,
    rev,
    signedAt,
    verify: verifyUrl,
  });

  const stampText = [
    `Система: ${systemName}`,
    `Документ: ${docId}`,
    `Ревизия: ${rev}`,
    `Подписан: ${date.toLocaleDateString('ru-RU')}`,
    `Проверка: ${verifyUrl}`,
  ].join('\n');

  return {
    qrData,
    stampText,
    documentId: docId,
    revision: rev,
    system: systemName,
    signedAt,
    verifyUrl,
  };
}

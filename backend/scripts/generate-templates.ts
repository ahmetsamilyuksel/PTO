/**
 * Script to generate DOCX template files for the DocOps system.
 * Run: npx tsx scripts/generate-templates.ts
 *
 * Templates use {{placeholder}} syntax for docxtemplater.
 */
import * as fs from 'fs';
import * as path from 'path';

// We'll create templates as simple text files with placeholder markers.
// In production, these would be properly formatted DOCX files.
// The system uses docxtemplater which works with DOCX containing {tag} placeholders.

const templatesDir = path.join(__dirname, '..', 'templates');

if (!fs.existsSync(templatesDir)) {
  fs.mkdirSync(templatesDir, { recursive: true });
}

// For MVP, we create placeholder marker files that document the template structure.
// Real DOCX templates would be designed in Word with the same placeholders.

const templates = {
  'aosr_template.md': `# АОСР — Акт освидетельствования скрытых работ
## (Шаблон для docxtemplater — замените на .docx с теми же плейсхолдерами)

**Приложение 3 к РД-11-02-2006**

### АКТ ОСВИДЕТЕЛЬСТВОВАНИЯ СКРЫТЫХ РАБОТ №{act_number}

г. {project_city}                                                          «{act_date}»

**Объект капитального строительства:** {project_name}
**Адрес:** {project_address}

**Застройщик (технический заказчик):** {client_org_name}
в лице {client_rep_fio}, действующего на основании {client_rep_basis}

**Лицо, осуществляющее строительство:** {contractor_org_name}
в лице {contractor_rep_fio}, действующего на основании {contractor_rep_basis}

**Лицо, осуществляющее подготовку проектной документации:** {design_org_name}
в лице {design_rep_fio}

**Лицо, выполнившее работы:** {executor_org_name}
в лице {executor_rep_fio}

---

Произвели осмотр работ, выполненных:
**{work_name}**

в {location_name}

и составили настоящий акт о нижеследующем:

1. К освидетельствованию предъявлены следующие работы:
{work_description}

2. Работы выполнены по проектной документации:
{project_docs}

3. При выполнении работ применены:
{materials_used}

4. Предъявлены документы, подтверждающие качество:
{quality_docs}

5. Дата начала работ: {work_start_date}
   Дата окончания работ: {work_end_date}

6. Отступления от проектной документации:
{deviations}

**РЕШЕНИЕ:** {permission_note}

---

**Подписи:**

Представитель застройщика (тех. заказчика): _________________ / {client_rep_fio} /

Представитель лица, осуществляющего строительство: _________________ / {contractor_rep_fio} /

Представитель лица, осуществляющего строительство, по вопросам строительного контроля: _________________ / {qa_rep_fio} /

Представитель лица, выполнившего работы: _________________ / {executor_rep_fio} /

Представитель проектной организации (авторский надзор): _________________ / {design_rep_fio} /

---
_Сформировано системой ПТО DocOps | Документ ID: {document_id} | Ревизия: {revision}_
`,

  'site_handover_template.md': `# Акт передачи строительной площадки
## (Шаблон для docxtemplater)

### АКТ №{act_number}
### ПЕРЕДАЧИ СТРОИТЕЛЬНОЙ ПЛОЩАДКИ (ФРОНТА РАБОТ)

г. {project_city}                                                          «{act_date}»

**Объект:** {project_name}
**Адрес:** {project_address}
**Договор:** №{contract_number} от {contract_date}

**Заказчик:** {client_org_name}
в лице {client_rep_fio}

**Подрядчик:** {contractor_org_name}
в лице {contractor_rep_fio}

---

Заказчик передаёт, а Подрядчик принимает строительную площадку для производства работ.

**1. Описание площадки:**
{site_description}

**2. Границы площадки:**
{boundaries}

**3. Существующие условия площадки:**
{existing_conditions}

**4. Переданные геодезические знаки и реперы:**
{geodetic_marks}

**5. Подключения к инженерным сетям:**
{utilities}

**6. Особые условия:**
{special_conditions}

---

**Площадку сдал (Заказчик):** _________________ / {client_rep_fio} /

**Площадку принял (Подрядчик):** _________________ / {contractor_rep_fio} /

---
_Сформировано системой ПТО DocOps | Документ ID: {document_id} | Ревизия: {revision}_
`,

  'incoming_control_template.md': `# Акт входного контроля материалов
## (Шаблон для docxtemplater)

### АКТ №{act_number}
### ВХОДНОГО КОНТРОЛЯ МАТЕРИАЛОВ (ИЗДЕЛИЙ, КОНСТРУКЦИЙ)

г. {project_city}                                                          «{act_date}»

**Объект:** {project_name}
**Адрес:** {project_address}

Комиссия в составе:

Представитель подрядчика: {contractor_rep_fio} — {contractor_rep_position}
Инженер ПТО: {qa_rep_fio}

произвела входной контроль нижеуказанных материалов (изделий, конструкций):

---

| Параметр | Значение |
|----------|----------|
| Наименование | {material_name} |
| Производитель | {manufacturer} |
| Марка / тип | {brand} |
| Номер партии / лота | {batch_number} |
| Количество | {quantity} {unit} |
| Дата поступления | {arrival_date} |
| Номер накладной | {delivery_note} |
| Поставщик | {supplier_name} |

**Предъявленные документы:**
{cert_numbers}

**Результаты визуального осмотра:**
{visual_inspection}

**Результаты замеров / измерений:**
{measurements}

---

### ЗАКЛЮЧЕНИЕ: {result}

{notes}

---

**Представитель подрядчика:** _________________ / {contractor_rep_fio} /

**Инженер ПТО:** _________________ / {qa_rep_fio} /

---
_Сформировано системой ПТО DocOps | Документ ID: {document_id} | Ревизия: {revision}_
`,
};

for (const [filename, content] of Object.entries(templates)) {
  const filePath = path.join(templatesDir, filename);
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`Created: ${filePath}`);
}

console.log('\\nTemplate files generated. For production, create .docx files with the same {placeholder} tags.');
console.log('Use Microsoft Word or LibreOffice Writer to create properly formatted templates.');

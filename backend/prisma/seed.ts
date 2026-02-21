import { PrismaClient, UserRole, ProjectType, LocationType, WorkType, DocumentType, CertificateType, ControlResult, JournalType, ProjectMemberRole, SignatureRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Check if already seeded
  const existingUser = await prisma.person.findUnique({ where: { email: 'ahmet@saela.ru' } });
  if (existingUser) {
    console.log('Database already seeded, skipping...');
    return;
  }

  console.log('Seeding database...');

  // ─── Организации ───
  const zakazchik = await prisma.organization.create({
    data: {
      name: 'ООО "СтройИнвест"',
      shortName: 'СтройИнвест',
      inn: '7701234567',
      kpp: '770101001',
      ogrn: '1177700001234',
      address: 'г. Москва, ул. Строителей, д. 15, оф. 301',
      phone: '+7 (495) 123-45-67',
      email: 'info@stroyinvest.ru',
    },
  });

  const podryadchik = await prisma.organization.create({
    data: {
      name: 'ООО "САЭЛА Строй"',
      shortName: 'САЭЛА',
      inn: '7702345678',
      kpp: '770201001',
      ogrn: '1187700005678',
      address: 'г. Москва, ул. Монтажная, д. 8, стр. 2',
      phone: '+7 (495) 234-56-78',
      email: 'info@saela.ru',
    },
  });

  const proektOrg = await prisma.organization.create({
    data: {
      name: 'ООО "ПроектБюро"',
      shortName: 'ПроектБюро',
      inn: '7703456789',
      kpp: '770301001',
      ogrn: '1197700009012',
      address: 'г. Москва, пр-т Вернадского, д. 33',
      phone: '+7 (495) 345-67-89',
      email: 'info@proektburo.ru',
    },
  });

  const supplier = await prisma.organization.create({
    data: {
      name: 'ООО "ТехноМатериалы"',
      shortName: 'ТехноМат',
      inn: '7704567890',
      kpp: '770401001',
      ogrn: '1207700012345',
      address: 'г. Москва, Промышленная ул., д. 5',
      phone: '+7 (495) 456-78-90',
      email: 'sales@technomat.ru',
    },
  });

  // ─── Персонал ───
  const passwordHash = await bcrypt.hash('password123', 10);

  const engineer = await prisma.person.create({
    data: {
      fio: 'Юксель Ахмет Самиль',
      position: 'Инженер ПТО/ИТД',
      role: UserRole.ENGINEER,
      email: 'ahmet@saela.ru',
      passwordHash,
      phone: '+7 (916) 111-22-33',
      organizationId: podryadchik.id,
    },
  });

  const siteChief = await prisma.person.create({
    data: {
      fio: 'Иванов Пётр Сергеевич',
      position: 'Начальник участка',
      role: UserRole.SITE_MANAGER,
      email: 'ivanov@saela.ru',
      passwordHash,
      phone: '+7 (916) 222-33-44',
      sroNumber: 'СРО-С-123-456',
      sroOrg: 'СРО "Столичное строительство"',
      organizationId: podryadchik.id,
    },
  });

  const techNadzor = await prisma.person.create({
    data: {
      fio: 'Петрова Елена Владимировна',
      position: 'Представитель технадзора',
      role: UserRole.TECH_SUPERVISOR,
      email: 'petrova@stroyinvest.ru',
      passwordHash,
      phone: '+7 (916) 333-44-55',
      organizationId: zakazchik.id,
    },
  });

  const authorNadzor = await prisma.person.create({
    data: {
      fio: 'Сидоров Алексей Николаевич',
      position: 'ГИП / Авторский надзор',
      role: UserRole.AUTHOR_SUPERVISOR,
      email: 'sidorov@proektburo.ru',
      passwordHash,
      phone: '+7 (916) 444-55-66',
      organizationId: proektOrg.id,
    },
  });

  const hseOfficer = await prisma.person.create({
    data: {
      fio: 'Козлов Дмитрий Андреевич',
      position: 'Инженер по ОТ и ПБ',
      role: UserRole.HSE_OFFICER,
      email: 'kozlov@saela.ru',
      passwordHash,
      phone: '+7 (916) 555-66-77',
      organizationId: podryadchik.id,
    },
  });

  // ─── Проект ───
  const project = await prisma.project.create({
    data: {
      name: 'Жилой комплекс "Солнечный" - Корпус 3',
      code: 'ЖК-СОЛН-К3',
      address: 'г. Москва, ул. Академика Королёва, д. 21, корп. 3',
      contractNumber: 'ДС-2024/156',
      contractDate: new Date('2024-03-15'),
      projectType: ProjectType.NEW_CONSTRUCTION,
      startDate: new Date('2024-04-01'),
      plannedEndDate: new Date('2025-12-31'),
      description: 'Строительство 17-этажного жилого дома с подземной автостоянкой. Монолитный каркас, кирпичное заполнение, вентилируемый фасад.',
      clientOrgId: zakazchik.id,
      generalOrgId: podryadchik.id,
      designOrgId: proektOrg.id,
    },
  });

  // ─── Участники проекта ───
  await prisma.projectMember.createMany({
    data: [
      { projectId: project.id, personId: engineer.id, projectRole: ProjectMemberRole.QA_ENGINEER, canSign: true },
      { projectId: project.id, personId: siteChief.id, projectRole: ProjectMemberRole.SITE_CHIEF, canSign: true },
      { projectId: project.id, personId: techNadzor.id, projectRole: ProjectMemberRole.TECH_SUPERVISOR_REP, canSign: true },
      { projectId: project.id, personId: authorNadzor.id, projectRole: ProjectMemberRole.AUTHOR_SUPERVISOR_REP, canSign: true },
      { projectId: project.id, personId: hseOfficer.id, projectRole: ProjectMemberRole.HSE_RESPONSIBLE, canSign: false },
    ],
  });

  // ─── Локации / Зоны ───
  const building = await prisma.location.create({
    data: {
      projectId: project.id,
      name: 'Корпус 3',
      locationType: LocationType.BUILDING,
      sortOrder: 1,
    },
  });

  const sectionA = await prisma.location.create({
    data: {
      projectId: project.id,
      parentId: building.id,
      name: 'Секция А (оси 1-5 / А-Г)',
      locationType: LocationType.SECTION,
      sortOrder: 1,
    },
  });

  const sectionB = await prisma.location.create({
    data: {
      projectId: project.id,
      parentId: building.id,
      name: 'Секция Б (оси 5-9 / А-Г)',
      locationType: LocationType.SECTION,
      sortOrder: 2,
    },
  });

  const floor1A = await prisma.location.create({
    data: {
      projectId: project.id,
      parentId: sectionA.id,
      name: '1-й этаж',
      locationType: LocationType.FLOOR,
      sortOrder: 1,
    },
  });

  const floor2A = await prisma.location.create({
    data: {
      projectId: project.id,
      parentId: sectionA.id,
      name: '2-й этаж',
      locationType: LocationType.FLOOR,
      sortOrder: 2,
    },
  });

  // ─── Рабочие элементы (WBS) ───
  const wiConcrete1 = await prisma.workItem.create({
    data: {
      projectId: project.id,
      locationId: floor1A.id,
      code: 'К3-СА-Э1-БР-01',
      name: 'Бетонирование перекрытия 1 этажа, секция А',
      workType: WorkType.CONCRETE,
      unit: 'м³',
      quantity: 85.5,
      sortOrder: 1,
    },
  });

  const wiReinforcement1 = await prisma.workItem.create({
    data: {
      projectId: project.id,
      locationId: floor1A.id,
      code: 'К3-СА-Э1-АР-01',
      name: 'Армирование перекрытия 1 этажа, секция А',
      workType: WorkType.REINFORCEMENT,
      unit: 'т',
      quantity: 12.3,
      sortOrder: 2,
    },
  });

  const wiMasonry2 = await prisma.workItem.create({
    data: {
      projectId: project.id,
      locationId: floor2A.id,
      code: 'К3-СА-Э2-КЛ-01',
      name: 'Кладка наружных стен 2 этажа, секция А',
      workType: WorkType.MASONRY,
      unit: 'м³',
      quantity: 42.0,
      sortOrder: 3,
    },
  });

  // ─── Материалы ───
  const concrete = await prisma.material.create({
    data: {
      projectId: project.id,
      name: 'Бетон товарный В25 (М350) F200 W8',
      brand: 'В25 F200 W8',
      manufacturer: 'ООО "МосБетон"',
      batchNumber: 'БП-2024/1156',
      quantity: 90.0,
      unit: 'м³',
      arrivalDate: new Date('2024-06-15'),
      deliveryNote: 'ТН-2024/4521',
      supplierId: supplier.id,
    },
  });

  const rebar = await prisma.material.create({
    data: {
      projectId: project.id,
      name: 'Арматура А500С ∅12',
      brand: 'А500С',
      manufacturer: 'ПАО "Северсталь"',
      batchNumber: 'ПЛ-78923',
      quantity: 8.5,
      unit: 'т',
      arrivalDate: new Date('2024-06-10'),
      deliveryNote: 'ТН-2024/4480',
      supplierId: supplier.id,
    },
  });

  // ─── Сертификаты материалов ───
  await prisma.materialCertificate.create({
    data: {
      materialId: concrete.id,
      certType: CertificateType.PASSPORT,
      certNumber: 'ПС-2024/1156',
      issueDate: new Date('2024-06-15'),
      issuedBy: 'Лаборатория ООО "МосБетон"',
    },
  });

  await prisma.materialCertificate.create({
    data: {
      materialId: rebar.id,
      certType: CertificateType.CONFORMITY_CERT,
      certNumber: 'РОСС RU.НА52.Н02467',
      issueDate: new Date('2024-01-20'),
      expiryDate: new Date('2027-01-19'),
      issuedBy: 'ООО "СертСтандарт"',
    },
  });

  await prisma.materialCertificate.create({
    data: {
      materialId: rebar.id,
      certType: CertificateType.QUALITY_CERT,
      certNumber: 'СК-78923',
      issueDate: new Date('2024-05-30'),
      issuedBy: 'ОТК ПАО "Северсталь"',
    },
  });

  // ─── Входной контроль ───
  await prisma.incomingControl.create({
    data: {
      materialId: concrete.id,
      controlDate: new Date('2024-06-15'),
      inspectorId: engineer.id,
      result: ControlResult.ACCEPTED,
      visualCheck: 'Подвижность смеси П4, однородная консистенция, без комков и расслоения.',
      measurements: 'Температура смеси +22°C. Осадка конуса 18 см.',
      notes: 'Отобраны контрольные образцы: 3 куба 150×150×150 мм.',
    },
  });

  await prisma.incomingControl.create({
    data: {
      materialId: rebar.id,
      controlDate: new Date('2024-06-10'),
      inspectorId: engineer.id,
      result: ControlResult.ACCEPTED,
      visualCheck: 'Арматурные стержни без видимых дефектов, коррозии, трещин. Маркировка соответствует.',
      measurements: 'Диаметр ∅12 мм — фактический 11.9–12.1 мм (в допуске).',
    },
  });

  // ─── Привязка материалов к работам ───
  await prisma.materialUsage.create({
    data: {
      materialId: concrete.id,
      workItemId: wiConcrete1.id,
      quantity: 85.5,
      unit: 'м³',
      usedDate: new Date('2024-06-16'),
    },
  });

  await prisma.materialUsage.create({
    data: {
      materialId: rebar.id,
      workItemId: wiReinforcement1.id,
      quantity: 8.5,
      unit: 'т',
      usedDate: new Date('2024-06-14'),
    },
  });

  // ─── Шаблоны документов ───
  const aosrTemplate = await prisma.documentTemplate.create({
    data: {
      name: 'Акт освидетельствования скрытых работ (АОСР)',
      documentType: DocumentType.AOSR,
      description: 'Форма акта освидетельствования скрытых работ по РД-11-02-2006, Приложение 3',
      filePath: 'templates/aosr_template.docx',
      fields: {
        sections: [
          { key: 'act_number', label: 'Номер акта', type: 'text', required: true },
          { key: 'act_date', label: 'Дата составления', type: 'date', required: true },
          { key: 'work_name', label: 'Наименование скрытых работ', type: 'text', required: true },
          { key: 'project_docs', label: 'Проектная документация (шифр)', type: 'text', required: true },
          { key: 'work_description', label: 'Описание выполненных работ', type: 'textarea', required: true },
          { key: 'materials_used', label: 'Применённые материалы', type: 'textarea', required: true },
          { key: 'deviations', label: 'Отступления от проектной документации', type: 'textarea', required: false },
          { key: 'permission_note', label: 'Разрешается производство последующих работ', type: 'textarea', required: true },
        ],
      },
    },
  });

  const siteHandoverTemplate = await prisma.documentTemplate.create({
    data: {
      name: 'Акт передачи строительной площадки',
      documentType: DocumentType.SITE_HANDOVER,
      description: 'Акт передачи строительной площадки / фронта работ',
      filePath: 'templates/site_handover_template.docx',
      fields: {
        sections: [
          { key: 'act_number', label: 'Номер акта', type: 'text', required: true },
          { key: 'act_date', label: 'Дата', type: 'date', required: true },
          { key: 'site_description', label: 'Описание площадки', type: 'textarea', required: true },
          { key: 'boundaries', label: 'Границы площадки', type: 'textarea', required: true },
          { key: 'existing_conditions', label: 'Существующие условия', type: 'textarea', required: false },
          { key: 'geodetic_marks', label: 'Геодезические знаки', type: 'textarea', required: false },
          { key: 'utilities', label: 'Подключения к сетям', type: 'textarea', required: false },
          { key: 'special_conditions', label: 'Особые условия', type: 'textarea', required: false },
        ],
      },
    },
  });

  const incomingControlTemplate = await prisma.documentTemplate.create({
    data: {
      name: 'Акт входного контроля материалов',
      documentType: DocumentType.INCOMING_CONTROL_ACT,
      description: 'Форма акта входного контроля материалов, изделий, конструкций',
      filePath: 'templates/incoming_control_template.docx',
      fields: {
        sections: [
          { key: 'act_number', label: 'Номер акта', type: 'text', required: true },
          { key: 'act_date', label: 'Дата', type: 'date', required: true },
          { key: 'material_name', label: 'Наименование материала', type: 'text', required: true },
          { key: 'manufacturer', label: 'Производитель', type: 'text', required: true },
          { key: 'batch_number', label: 'Номер партии', type: 'text', required: true },
          { key: 'quantity', label: 'Количество', type: 'text', required: true },
          { key: 'cert_numbers', label: 'Номера сертификатов / паспортов', type: 'text', required: true },
          { key: 'visual_inspection', label: 'Результат визуального осмотра', type: 'textarea', required: true },
          { key: 'measurements', label: 'Результаты замеров', type: 'textarea', required: false },
          { key: 'result', label: 'Заключение (принять/отклонить)', type: 'text', required: true },
        ],
      },
    },
  });

  // ─── Документы (пример) ───
  const siteHandoverDoc = await prisma.document.create({
    data: {
      projectId: project.id,
      templateId: siteHandoverTemplate.id,
      documentType: DocumentType.SITE_HANDOVER,
      documentNumber: 'АКТ-001',
      title: 'Акт передачи строительной площадки — ЖК "Солнечный", Корпус 3',
      status: 'SIGNED',
      locationId: building.id,
      createdById: engineer.id,
      documentDate: new Date('2024-04-01'),
      lockedAt: new Date('2024-04-02'),
      data: {
        act_number: 'АКТ-001',
        act_date: '2024-04-01',
        site_description: 'Строительная площадка по адресу: г. Москва, ул. Ак. Королёва, д. 21, корп. 3. Площадь участка — 4 200 м².',
        boundaries: 'Ограждение — временный забор по периметру, высота 2.0 м. Въезд с ул. Ак. Королёва.',
        existing_conditions: 'Площадка очищена от строений. Выполнена вертикальная планировка. Подведены временные сети.',
        geodetic_marks: 'Передано 4 реперных знака согласно акту разбивки осей.',
        utilities: 'Временное электроснабжение 380В/250кВт, водоснабжение ∅50 мм, канализация.',
      },
    },
  });

  // Подписи для акта передачи
  await prisma.documentSignature.createMany({
    data: [
      { documentId: siteHandoverDoc.id, personId: siteChief.id, signRole: SignatureRole.CONTRACTOR, status: 'SIGNED', signedAt: new Date('2024-04-01'), sortOrder: 1 },
      { documentId: siteHandoverDoc.id, personId: techNadzor.id, signRole: SignatureRole.CLIENT_REP, status: 'SIGNED', signedAt: new Date('2024-04-01'), sortOrder: 2 },
    ],
  });

  // АОСР (черновик)
  const aosrDoc = await prisma.document.create({
    data: {
      projectId: project.id,
      templateId: aosrTemplate.id,
      documentType: DocumentType.AOSR,
      documentNumber: 'АОСР-001',
      title: 'АОСР — Армирование перекрытия 1 этажа, секция А',
      status: 'DRAFT',
      locationId: floor1A.id,
      workItemId: wiReinforcement1.id,
      createdById: engineer.id,
      documentDate: new Date('2024-06-14'),
      data: {
        act_number: 'АОСР-001',
        act_date: '2024-06-14',
        work_name: 'Армирование монолитного перекрытия над 1 этажом',
        project_docs: 'Шифр 2024-156-КР, лист 15',
        work_description: 'Выполнено армирование монолитного перекрытия над 1-м этажом в осях 1-5/А-Г. Нижняя сетка ∅12 А500С шаг 200×200, верхняя сетка ∅12 А500С шаг 200×200. Защитный слой 25 мм обеспечен фиксаторами.',
        materials_used: 'Арматура А500С ∅12 — 8.5 т (партия ПЛ-78923, сертификат РОСС RU.НА52.Н02467)',
        deviations: 'Отступлений от проектной документации нет.',
        permission_note: 'Разрешается производство работ по бетонированию перекрытия над 1 этажом.',
      },
    },
  });

  // ─── Журнал (общий) ───
  const generalJournal = await prisma.journal.create({
    data: {
      projectId: project.id,
      journalType: JournalType.GENERAL,
      title: 'Общий журнал работ — ЖК "Солнечный", Корпус 3',
      startDate: new Date('2024-04-01'),
    },
  });

  // Записи журнала
  const entry1 = await prisma.journalEntry.create({
    data: {
      journalId: generalJournal.id,
      entryNumber: 1,
      entryDate: new Date('2024-06-10'),
      weatherConditions: 'Ясно, без осадков',
      temperature: '+24°C',
      crewInfo: 'Бригада арматурщиков — 6 чел., бригадир Смирнов А.В.',
      workDescription: 'Армирование нижней сетки перекрытия 1 этажа, секция А (оси 1-3/А-Г). Установка фиксаторов защитного слоя.',
      materialsUsed: 'Арматура А500С ∅12 — 4.2 т',
      controlActions: 'Проверка шага арматуры, защитного слоя. Замечаний нет.',
      authorId: siteChief.id,
      locationId: floor1A.id,
      workItemId: wiReinforcement1.id,
    },
  });

  const entry2 = await prisma.journalEntry.create({
    data: {
      journalId: generalJournal.id,
      entryNumber: 2,
      entryDate: new Date('2024-06-12'),
      weatherConditions: 'Переменная облачность',
      temperature: '+22°C',
      crewInfo: 'Бригада арматурщиков — 6 чел., бригадир Смирнов А.В.',
      workDescription: 'Армирование верхней сетки перекрытия 1 этажа, секция А (оси 1-5/А-Г). Установка каркасов и хомутов.',
      materialsUsed: 'Арматура А500С ∅12 — 4.3 т',
      controlActions: 'Проверка армирования по проекту 2024-156-КР, лист 15. Готовность к освидетельствованию скрытых работ.',
      authorId: siteChief.id,
      locationId: floor1A.id,
      workItemId: wiReinforcement1.id,
    },
  });

  // Связь записей журнала с документами
  await prisma.journalEntryDocLink.create({
    data: {
      journalEntryId: entry2.id,
      documentId: aosrDoc.id,
    },
  });

  // ─── Правила матрицы документов ───
  const matrixRules = [
    {
      projectId: project.id,
      workType: WorkType.CONCRETE,
      documentType: DocumentType.AOSR,
      triggerEvent: 'Перед бетонированием (закрытие арматуры)',
      preparedByRole: ProjectMemberRole.QA_ENGINEER,
      checkedByRole: ProjectMemberRole.SITE_CHIEF,
      signedByRoles: [ProjectMemberRole.SITE_CHIEF, ProjectMemberRole.TECH_SUPERVISOR_REP, ProjectMemberRole.AUTHOR_SUPERVISOR_REP],
      requiredAttachments: ['Исполнительная схема армирования', 'Сертификат на арматуру', 'Фото'],
      linkedJournalType: JournalType.GENERAL,
      sortOrder: 1,
    },
    {
      projectId: project.id,
      workType: WorkType.CONCRETE,
      documentType: DocumentType.TEST_PROTOCOL,
      triggerEvent: 'После набора прочности бетона (7/28 суток)',
      preparedByRole: ProjectMemberRole.QA_ENGINEER,
      signedByRoles: [ProjectMemberRole.QA_ENGINEER],
      requiredAttachments: ['Протокол лаборатории'],
      sortOrder: 2,
    },
    {
      projectId: project.id,
      workType: WorkType.REINFORCEMENT,
      documentType: DocumentType.AOSR,
      triggerEvent: 'После завершения армирования (до бетонирования)',
      preparedByRole: ProjectMemberRole.QA_ENGINEER,
      checkedByRole: ProjectMemberRole.SITE_CHIEF,
      signedByRoles: [ProjectMemberRole.SITE_CHIEF, ProjectMemberRole.TECH_SUPERVISOR_REP, ProjectMemberRole.AUTHOR_SUPERVISOR_REP],
      requiredAttachments: ['Исполнительная схема', 'Сертификат на арматуру', 'Акт входного контроля'],
      linkedJournalType: JournalType.GENERAL,
      sortOrder: 3,
    },
    {
      projectId: project.id,
      workType: WorkType.MASONRY,
      documentType: DocumentType.AOSR,
      triggerEvent: 'После выполнения кладки (до отделки)',
      preparedByRole: ProjectMemberRole.QA_ENGINEER,
      checkedByRole: ProjectMemberRole.SITE_CHIEF,
      signedByRoles: [ProjectMemberRole.SITE_CHIEF, ProjectMemberRole.TECH_SUPERVISOR_REP],
      requiredAttachments: ['Исполнительная схема кладки', 'Сертификат на кирпич/блоки', 'Сертификат на раствор'],
      linkedJournalType: JournalType.GENERAL,
      sortOrder: 4,
    },
    {
      projectId: project.id,
      workType: WorkType.WATERPROOFING,
      documentType: DocumentType.AOSR,
      triggerEvent: 'После устройства гидроизоляции (до закрытия)',
      preparedByRole: ProjectMemberRole.QA_ENGINEER,
      checkedByRole: ProjectMemberRole.SITE_CHIEF,
      signedByRoles: [ProjectMemberRole.SITE_CHIEF, ProjectMemberRole.TECH_SUPERVISOR_REP],
      requiredAttachments: ['Сертификат на материал', 'Фото'],
      sortOrder: 5,
    },
    {
      projectId: project.id,
      workType: WorkType.HVAC,
      documentType: DocumentType.NETWORK_ACT,
      triggerEvent: 'После монтажа участка системы ОВ',
      preparedByRole: ProjectMemberRole.QA_ENGINEER,
      checkedByRole: ProjectMemberRole.SITE_CHIEF,
      signedByRoles: [ProjectMemberRole.SITE_CHIEF, ProjectMemberRole.TECH_SUPERVISOR_REP],
      requiredAttachments: ['Исполнительная схема', 'Сертификаты на оборудование'],
      linkedJournalType: JournalType.INSTALLATION,
      sortOrder: 6,
    },
    {
      projectId: project.id,
      workType: WorkType.PLUMBING,
      documentType: DocumentType.NETWORK_ACT,
      triggerEvent: 'После монтажа участка системы ВК',
      preparedByRole: ProjectMemberRole.QA_ENGINEER,
      checkedByRole: ProjectMemberRole.SITE_CHIEF,
      signedByRoles: [ProjectMemberRole.SITE_CHIEF, ProjectMemberRole.TECH_SUPERVISOR_REP],
      requiredAttachments: ['Исполнительная схема', 'Протокол гидравлических испытаний'],
      linkedJournalType: JournalType.INSTALLATION,
      sortOrder: 7,
    },
    {
      projectId: project.id,
      workType: WorkType.ELECTRICAL,
      documentType: DocumentType.NETWORK_ACT,
      triggerEvent: 'После монтажа участка электросети',
      preparedByRole: ProjectMemberRole.QA_ENGINEER,
      checkedByRole: ProjectMemberRole.SITE_CHIEF,
      signedByRoles: [ProjectMemberRole.SITE_CHIEF, ProjectMemberRole.TECH_SUPERVISOR_REP],
      requiredAttachments: ['Исполнительная схема', 'Протокол измерений сопротивления изоляции'],
      linkedJournalType: JournalType.INSTALLATION,
      sortOrder: 8,
    },
    {
      projectId: project.id,
      workType: WorkType.STEEL_STRUCTURE,
      documentType: DocumentType.AOOK,
      triggerEvent: 'После монтажа ответственной металлоконструкции',
      preparedByRole: ProjectMemberRole.QA_ENGINEER,
      checkedByRole: ProjectMemberRole.SITE_CHIEF,
      signedByRoles: [ProjectMemberRole.SITE_CHIEF, ProjectMemberRole.TECH_SUPERVISOR_REP, ProjectMemberRole.AUTHOR_SUPERVISOR_REP],
      requiredAttachments: ['Исполнительная схема', 'Сертификат на металл', 'Журнал сварки', 'Протокол NDT'],
      linkedJournalType: JournalType.WELDING,
      sortOrder: 9,
    },
  ];

  for (const rule of matrixRules) {
    await prisma.documentMatrixRule.create({ data: rule });
  }

  // ─── Аудит-лог (примеры) ───
  await prisma.auditLog.createMany({
    data: [
      {
        entityType: 'Project',
        entityId: project.id,
        action: 'CREATE',
        performedById: engineer.id,
        newValues: { name: project.name },
      },
      {
        entityType: 'Document',
        entityId: siteHandoverDoc.id,
        action: 'CREATE',
        performedById: engineer.id,
        newValues: { title: siteHandoverDoc.title },
      },
      {
        entityType: 'Document',
        entityId: siteHandoverDoc.id,
        action: 'STATUS_CHANGE',
        performedById: siteChief.id,
        oldValues: { status: 'DRAFT' },
        newValues: { status: 'SIGNED' },
      },
      {
        entityType: 'Document',
        entityId: aosrDoc.id,
        action: 'CREATE',
        performedById: engineer.id,
        newValues: { title: aosrDoc.title },
      },
    ],
  });

  console.log('Seed completed successfully!');
  console.log('---');
  console.log('Demo credentials:');
  console.log('  Engineer: ahmet@saela.ru / password123');
  console.log('  Site Chief: ivanov@saela.ru / password123');
  console.log('  Tech Supervisor: petrova@stroyinvest.ru / password123');
  console.log('  Author Supervisor: sidorov@proektburo.ru / password123');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

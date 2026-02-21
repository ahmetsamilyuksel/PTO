import {
  WorkType,
  DocumentType,
  ProjectMemberRole,
  JournalType,
} from '@prisma/client';
import { prisma } from '../index';

// ─── Правило матрицы документов по умолчанию ───
export interface MatrixRuleDefinition {
  workType: WorkType;
  documentType: DocumentType;
  triggerEvent: string;
  preparedByRole: ProjectMemberRole;
  checkedByRole?: ProjectMemberRole;
  signedByRoles: ProjectMemberRole[];
  requiredAttachments: string[];
  linkedJournalType?: JournalType;
}

/**
 * DEFAULT_MATRIX_RULES — правила по умолчанию, определяющие какие документы
 * нужны для каждого вида работ согласно РД-11-02-2006, СП 48.13330.2019
 */
export const DEFAULT_MATRIX_RULES: MatrixRuleDefinition[] = [
  // ═══════════════════════════════════════════
  // БЕТОННЫЕ РАБОТЫ (CONCRETE)
  // ═══════════════════════════════════════════
  {
    workType: WorkType.CONCRETE,
    documentType: DocumentType.AOSR,
    triggerEvent: 'Завершение скрытых бетонных работ перед следующим этапом',
    preparedByRole: ProjectMemberRole.RESPONSIBLE_PRODUCER,
    checkedByRole: ProjectMemberRole.QA_ENGINEER,
    signedByRoles: [
      ProjectMemberRole.RESPONSIBLE_PRODUCER,
      ProjectMemberRole.TECH_SUPERVISOR_REP,
      ProjectMemberRole.AUTHOR_SUPERVISOR_REP,
    ],
    requiredAttachments: [
      'Паспорта/сертификаты на бетонную смесь',
      'Исполнительная схема',
      'Фотофиксация',
    ],
    linkedJournalType: JournalType.CONCRETE,
  },
  {
    workType: WorkType.CONCRETE,
    documentType: DocumentType.TEST_PROTOCOL,
    triggerEvent: 'Набор прочности бетоном (7/14/28 суток)',
    preparedByRole: ProjectMemberRole.QA_ENGINEER,
    checkedByRole: undefined,
    signedByRoles: [
      ProjectMemberRole.QA_ENGINEER,
      ProjectMemberRole.TECH_SUPERVISOR_REP,
    ],
    requiredAttachments: [
      'Протокол лабораторных испытаний',
      'Акт отбора образцов',
    ],
    linkedJournalType: JournalType.CONCRETE,
  },
  {
    workType: WorkType.CONCRETE,
    documentType: DocumentType.EXECUTIVE_DRAWING,
    triggerEvent: 'Завершение бетонирования конструкции',
    preparedByRole: ProjectMemberRole.QA_ENGINEER,
    checkedByRole: ProjectMemberRole.RESPONSIBLE_PRODUCER,
    signedByRoles: [
      ProjectMemberRole.RESPONSIBLE_PRODUCER,
      ProjectMemberRole.TECH_SUPERVISOR_REP,
    ],
    requiredAttachments: [
      'Исполнительная геодезическая схема',
    ],
    linkedJournalType: undefined,
  },

  // ═══════════════════════════════════════════
  // АРМАТУРНЫЕ РАБОТЫ (REINFORCEMENT)
  // ═══════════════════════════════════════════
  {
    workType: WorkType.REINFORCEMENT,
    documentType: DocumentType.AOSR,
    triggerEvent: 'Завершение армирования перед бетонированием',
    preparedByRole: ProjectMemberRole.RESPONSIBLE_PRODUCER,
    checkedByRole: ProjectMemberRole.QA_ENGINEER,
    signedByRoles: [
      ProjectMemberRole.RESPONSIBLE_PRODUCER,
      ProjectMemberRole.TECH_SUPERVISOR_REP,
      ProjectMemberRole.AUTHOR_SUPERVISOR_REP,
    ],
    requiredAttachments: [
      'Паспорта/сертификаты на арматуру',
      'Исполнительная схема армирования',
      'Фотофиксация',
      'Журнал сварочных работ (при наличии сварных соединений)',
    ],
    linkedJournalType: undefined,
  },

  // ═══════════════════════════════════════════
  // КЛАДОЧНЫЕ РАБОТЫ (MASONRY)
  // ═══════════════════════════════════════════
  {
    workType: WorkType.MASONRY,
    documentType: DocumentType.AOSR,
    triggerEvent: 'Завершение кладки до закрытия следующим слоем',
    preparedByRole: ProjectMemberRole.RESPONSIBLE_PRODUCER,
    checkedByRole: ProjectMemberRole.QA_ENGINEER,
    signedByRoles: [
      ProjectMemberRole.RESPONSIBLE_PRODUCER,
      ProjectMemberRole.TECH_SUPERVISOR_REP,
      ProjectMemberRole.AUTHOR_SUPERVISOR_REP,
    ],
    requiredAttachments: [
      'Паспорта/сертификаты на кирпич/блоки',
      'Паспорта/сертификаты на раствор',
      'Исполнительная схема',
      'Фотофиксация',
    ],
    linkedJournalType: undefined,
  },

  // ═══════════════════════════════════════════
  // ГИДРОИЗОЛЯЦИЯ (WATERPROOFING)
  // ═══════════════════════════════════════════
  {
    workType: WorkType.WATERPROOFING,
    documentType: DocumentType.AOSR,
    triggerEvent: 'Завершение гидроизоляционных работ до закрытия',
    preparedByRole: ProjectMemberRole.RESPONSIBLE_PRODUCER,
    checkedByRole: ProjectMemberRole.QA_ENGINEER,
    signedByRoles: [
      ProjectMemberRole.RESPONSIBLE_PRODUCER,
      ProjectMemberRole.TECH_SUPERVISOR_REP,
      ProjectMemberRole.AUTHOR_SUPERVISOR_REP,
    ],
    requiredAttachments: [
      'Паспорта/сертификаты на гидроизоляционные материалы',
      'Протокол испытания на водонепроницаемость (при наличии)',
      'Фотофиксация',
    ],
    linkedJournalType: undefined,
  },

  // ═══════════════════════════════════════════
  // ТЕПЛОИЗОЛЯЦИЯ (INSULATION)
  // ═══════════════════════════════════════════
  {
    workType: WorkType.INSULATION,
    documentType: DocumentType.AOSR,
    triggerEvent: 'Завершение теплоизоляционных работ до закрытия отделкой',
    preparedByRole: ProjectMemberRole.RESPONSIBLE_PRODUCER,
    checkedByRole: ProjectMemberRole.QA_ENGINEER,
    signedByRoles: [
      ProjectMemberRole.RESPONSIBLE_PRODUCER,
      ProjectMemberRole.TECH_SUPERVISOR_REP,
      ProjectMemberRole.AUTHOR_SUPERVISOR_REP,
    ],
    requiredAttachments: [
      'Паспорта/сертификаты на утеплитель',
      'Сертификат пожарной безопасности утеплителя',
      'Фотофиксация',
    ],
    linkedJournalType: JournalType.INSULATION,
  },

  // ═══════════════════════════════════════════
  // ОВиК (HVAC)
  // ═══════════════════════════════════════════
  {
    workType: WorkType.HVAC,
    documentType: DocumentType.NETWORK_ACT,
    triggerEvent: 'Завершение монтажа участка сети ОВиК',
    preparedByRole: ProjectMemberRole.RESPONSIBLE_PRODUCER,
    checkedByRole: ProjectMemberRole.QA_ENGINEER,
    signedByRoles: [
      ProjectMemberRole.RESPONSIBLE_PRODUCER,
      ProjectMemberRole.TECH_SUPERVISOR_REP,
      ProjectMemberRole.AUTHOR_SUPERVISOR_REP,
    ],
    requiredAttachments: [
      'Паспорта/сертификаты на оборудование',
      'Паспорта/сертификаты на трубопроводы/воздуховоды',
      'Исполнительная схема сети',
      'Протокол испытания (опрессовка)',
      'Фотофиксация',
    ],
    linkedJournalType: JournalType.INSTALLATION,
  },

  // ═══════════════════════════════════════════
  // ВК — Водоснабжение/Канализация (PLUMBING)
  // ═══════════════════════════════════════════
  {
    workType: WorkType.PLUMBING,
    documentType: DocumentType.NETWORK_ACT,
    triggerEvent: 'Завершение монтажа участка сети ВК',
    preparedByRole: ProjectMemberRole.RESPONSIBLE_PRODUCER,
    checkedByRole: ProjectMemberRole.QA_ENGINEER,
    signedByRoles: [
      ProjectMemberRole.RESPONSIBLE_PRODUCER,
      ProjectMemberRole.TECH_SUPERVISOR_REP,
      ProjectMemberRole.AUTHOR_SUPERVISOR_REP,
    ],
    requiredAttachments: [
      'Паспорта/сертификаты на трубопроводы и фитинги',
      'Паспорта/сертификаты на сантехническое оборудование',
      'Исполнительная схема сети',
      'Протокол гидравлического испытания',
      'Фотофиксация',
    ],
    linkedJournalType: JournalType.INSTALLATION,
  },

  // ═══════════════════════════════════════════
  // ЭОМ — Электромонтаж (ELECTRICAL)
  // ═══════════════════════════════════════════
  {
    workType: WorkType.ELECTRICAL,
    documentType: DocumentType.NETWORK_ACT,
    triggerEvent: 'Завершение монтажа участка электрической сети',
    preparedByRole: ProjectMemberRole.RESPONSIBLE_PRODUCER,
    checkedByRole: ProjectMemberRole.QA_ENGINEER,
    signedByRoles: [
      ProjectMemberRole.RESPONSIBLE_PRODUCER,
      ProjectMemberRole.TECH_SUPERVISOR_REP,
      ProjectMemberRole.AUTHOR_SUPERVISOR_REP,
    ],
    requiredAttachments: [
      'Паспорта/сертификаты на кабельную продукцию',
      'Паспорта/сертификаты на электрооборудование',
      'Исполнительная схема сети',
      'Протокол замера сопротивления изоляции',
      'Фотофиксация',
    ],
    linkedJournalType: JournalType.INSTALLATION,
  },

  // ═══════════════════════════════════════════
  // МЕТАЛЛОКОНСТРУКЦИИ (STEEL_STRUCTURE)
  // ═══════════════════════════════════════════
  {
    workType: WorkType.STEEL_STRUCTURE,
    documentType: DocumentType.AOOK,
    triggerEvent: 'Завершение монтажа ответственной конструкции (металлоконструкции)',
    preparedByRole: ProjectMemberRole.RESPONSIBLE_PRODUCER,
    checkedByRole: ProjectMemberRole.QA_ENGINEER,
    signedByRoles: [
      ProjectMemberRole.RESPONSIBLE_PRODUCER,
      ProjectMemberRole.TECH_SUPERVISOR_REP,
      ProjectMemberRole.AUTHOR_SUPERVISOR_REP,
    ],
    requiredAttachments: [
      'Паспорта/сертификаты на металлоконструкции',
      'Журнал сварочных работ',
      'Протокол контроля сварных соединений (УЗК/рентген)',
      'Исполнительная схема',
      'Фотофиксация',
      'Сертификаты на сварочные материалы',
    ],
    linkedJournalType: JournalType.WELDING,
  },
];

/**
 * Создаёт записи DocumentMatrixRule для проекта на основании указанных видов работ.
 * Если workTypes не переданы — применяются все правила из DEFAULT_MATRIX_RULES.
 */
export async function generateMatrixForProject(
  projectId: string,
  workTypes?: WorkType[]
): Promise<number> {
  const rulesToApply = workTypes
    ? DEFAULT_MATRIX_RULES.filter((r) => workTypes.includes(r.workType))
    : DEFAULT_MATRIX_RULES;

  if (rulesToApply.length === 0) {
    return 0;
  }

  // Удаляем старые автоматически созданные правила для этого проекта (перегенерация)
  await prisma.documentMatrixRule.deleteMany({
    where: { projectId },
  });

  const created = await prisma.$transaction(
    rulesToApply.map((rule, index) =>
      prisma.documentMatrixRule.create({
        data: {
          projectId,
          workType: rule.workType,
          documentType: rule.documentType,
          triggerEvent: rule.triggerEvent,
          preparedByRole: rule.preparedByRole,
          checkedByRole: rule.checkedByRole ?? null,
          signedByRoles: rule.signedByRoles,
          requiredAttachments: rule.requiredAttachments,
          linkedJournalType: rule.linkedJournalType ?? null,
          isActive: true,
          sortOrder: index,
        },
      })
    )
  );

  return created.length;
}

/**
 * Возвращает список правил (какие документы нужны) для данного вида работ.
 * Сначала ищет проектные правила, при отсутствии — возвращает дефолтные.
 */
export async function getRequiredDocuments(
  workType: WorkType,
  projectId?: string
): Promise<MatrixRuleDefinition[]> {
  // Если указан проект — ищем в БД
  if (projectId) {
    const projectRules = await prisma.documentMatrixRule.findMany({
      where: {
        projectId,
        workType,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    if (projectRules.length > 0) {
      return projectRules.map((r) => ({
        workType: r.workType,
        documentType: r.documentType,
        triggerEvent: r.triggerEvent,
        preparedByRole: r.preparedByRole,
        checkedByRole: r.checkedByRole ?? undefined,
        signedByRoles: r.signedByRoles as ProjectMemberRole[],
        requiredAttachments: (r.requiredAttachments as string[]) ?? [],
        linkedJournalType: r.linkedJournalType ?? undefined,
      }));
    }
  }

  // Возвращаем правила по умолчанию
  return DEFAULT_MATRIX_RULES.filter((r) => r.workType === workType);
}

/**
 * Возвращает все виды документов, необходимые для данного вида работ.
 */
export function getRequiredDocumentTypes(workType: WorkType): DocumentType[] {
  return DEFAULT_MATRIX_RULES
    .filter((r) => r.workType === workType)
    .map((r) => r.documentType);
}

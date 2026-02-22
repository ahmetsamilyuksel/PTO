// ========== Enums (matching Prisma schema) ==========

export type UserRole =
  | 'ADMIN'
  | 'PROJECT_MANAGER'
  | 'SITE_MANAGER'
  | 'ENGINEER'
  | 'TECH_SUPERVISOR'
  | 'AUTHOR_SUPERVISOR'
  | 'LAB_TECHNICIAN'
  | 'SUPPLIER'
  | 'HSE_OFFICER';

export type ProjectType =
  | 'NEW_CONSTRUCTION'
  | 'RECONSTRUCTION'
  | 'CAPITAL_REPAIR'
  | 'INTERIOR_FINISHING';

export type ProjectStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'COMPLETED'
  | 'ARCHIVED';

export type ProjectMemberRole =
  | 'RESPONSIBLE_PRODUCER'
  | 'SITE_CHIEF'
  | 'QA_ENGINEER'
  | 'TECH_SUPERVISOR_REP'
  | 'AUTHOR_SUPERVISOR_REP'
  | 'HSE_RESPONSIBLE'
  | 'OTHER';

export type LocationType =
  | 'BUILDING'
  | 'SECTION'
  | 'FLOOR'
  | 'ROOM'
  | 'ZONE'
  | 'AXIS';

export type WorkType =
  | 'CONCRETE'
  | 'REINFORCEMENT'
  | 'STEEL_STRUCTURE'
  | 'MASONRY'
  | 'WATERPROOFING'
  | 'INSULATION'
  | 'ROOFING'
  | 'PLASTERING'
  | 'PAINTING'
  | 'TILING'
  | 'FLOORING'
  | 'HVAC'
  | 'PLUMBING'
  | 'ELECTRICAL'
  | 'FIRE_PROTECTION'
  | 'LOW_VOLTAGE'
  | 'GEODETIC'
  | 'EARTHWORK'
  | 'FOUNDATION'
  | 'OTHER';

export type WorkItemStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'ACCEPTED';

export type DocumentType =
  | 'SITE_HANDOVER'
  | 'ASSIGNMENT_ORDER'
  | 'HSE_BRIEFING'
  | 'PPR_UPLOAD'
  | 'KICKOFF_PROTOCOL'
  | 'AOSR'
  | 'AOOK'
  | 'NETWORK_ACT'
  | 'GEODETIC_ACT'
  | 'EXECUTIVE_DRAWING'
  | 'INCOMING_CONTROL_ACT'
  | 'MATERIAL_CERTIFICATE'
  | 'TEST_PROTOCOL'
  | 'INTERIM_ACCEPTANCE'
  | 'DEFECT_LIST'
  | 'COMPLETION_ACT'
  | 'ID_HANDOVER'
  | 'CORRESPONDENCE'
  | 'OTHER';

export type DocumentStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'REVISION_REQUESTED'
  | 'PENDING_SIGNATURE'
  | 'SIGNED'
  | 'ARCHIVED'
  | 'IN_PACKAGE';

export type CertificateType =
  | 'PASSPORT'
  | 'CONFORMITY_CERT'
  | 'DECLARATION'
  | 'TEST_REPORT'
  | 'QUALITY_CERT'
  | 'FIRE_CERT'
  | 'SANITARY_CERT'
  | 'OTHER';

export type ControlResult =
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CONDITIONALLY_ACCEPTED';

export type SignatureRole =
  | 'PREPARED_BY'
  | 'CHECKED_BY'
  | 'APPROVED_BY'
  | 'CONTRACTOR'
  | 'CLIENT_REP'
  | 'TECH_SUPERVISOR'
  | 'AUTHOR_SUPERVISOR';

export type SignatureStatus =
  | 'PENDING'
  | 'SIGNED'
  | 'REJECTED'
  | 'DELEGATED';

export type JournalType =
  | 'GENERAL'
  | 'CONCRETE'
  | 'WELDING'
  | 'ANTICORROSION'
  | 'INSULATION'
  | 'PILE_DRIVING'
  | 'GEODETIC'
  | 'INSTALLATION'
  | 'OTHER';

export type JournalStatus =
  | 'ACTIVE'
  | 'CLOSED'
  | 'ARCHIVED';

export type PackageStatus =
  | 'DRAFT'
  | 'GENERATING'
  | 'READY'
  | 'DELIVERED';

export type AttachmentCategory =
  | 'PHOTO'
  | 'DRAWING'
  | 'CERTIFICATE'
  | 'PROTOCOL'
  | 'SCHEME'
  | 'CORRESPONDENCE'
  | 'OTHER';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'STATUS_CHANGE'
  | 'SIGN'
  | 'REJECT'
  | 'EXPORT'
  | 'PACKAGE';

// ========== Interfaces ==========

export interface User {
  id: string;
  email: string;
  fio: string;
  fullName?: string; // alias for fio in some contexts
  position?: string;
  role: UserRole;
  phone?: string;
  organization?: Organization;
}

export interface Organization {
  id: string;
  name: string;
  shortName?: string;
  inn?: string;
  kpp?: string;
  ogrn?: string;
  address?: string;
  phone?: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Person {
  id: string;
  fio: string;
  position?: string;
  role: UserRole;
  email: string;
  phone?: string;
  sroNumber?: string;
  sroOrg?: string;
  certificateInfo?: string;
  organizationId?: string;
  organization?: Organization;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  address?: string;
  contractNumber?: string;
  contractDate?: string;
  projectType: ProjectType;
  startDate?: string;
  plannedEndDate?: string;
  normativeSet?: string;
  documentLang?: string;
  description?: string;
  status: ProjectStatus;
  clientOrg?: Organization;
  generalOrg?: Organization;
  subOrg?: Organization;
  designOrg?: Organization;
  members?: ProjectMember[];
  locations?: Location[];
  workItems?: WorkItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  personId: string;
  projectRole: ProjectMemberRole;
  canSign: boolean;
  person: Person;
}

export interface Location {
  id: string;
  projectId: string;
  parentId?: string;
  name: string;
  locationType: LocationType;
  sortOrder: number;
  children?: Location[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkItem {
  id: string;
  projectId: string;
  locationId?: string;
  parentId?: string;
  code: string;
  name: string;
  workType: WorkType;
  description?: string;
  unit?: string;
  quantity?: number;
  sortOrder: number;
  status: WorkItemStatus;
  location?: Location;
  children?: WorkItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Material {
  id: string;
  projectId: string;
  name: string;
  brand?: string;
  manufacturer?: string;
  batchNumber?: string;
  quantity?: number;
  unit?: string;
  arrivalDate?: string;
  deliveryNote?: string;
  supplierId?: string;
  supplier?: Organization;
  certificates?: MaterialCertificate[];
  incomingControls?: IncomingControl[];
  createdAt: string;
  updatedAt: string;
}

export interface MaterialCertificate {
  id: string;
  materialId: string;
  certType: CertificateType;
  certNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  issuedBy?: string;
  filePath?: string;
  fileName?: string;
  createdAt: string;
}

export interface IncomingControl {
  id: string;
  materialId: string;
  controlDate: string;
  inspectorId: string;
  result: ControlResult;
  visualCheck?: string;
  measurements?: string;
  notes?: string;
  inspector?: Person;
  photos?: Attachment[];
  createdAt: string;
}

export interface Document {
  id: string;
  projectId: string;
  templateId?: string;
  documentType: DocumentType;
  documentNumber?: string;
  title: string;
  status: DocumentStatus;
  revision: number;
  locationId?: string;
  workItemId?: string;
  data?: Record<string, any>;
  filePath?: string;
  fileName?: string;
  createdById: string;
  documentDate: string;
  lockedAt?: string;
  location?: Location;
  workItem?: WorkItem;
  template?: DocumentTemplate;
  createdBy?: Person;
  signatures?: DocumentSignature[];
  attachments?: Attachment[];
  workflowHistory?: WorkflowTransition[];
  createdAt: string;
  updatedAt: string;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  documentType: DocumentType;
  description?: string;
  filePath: string;
  version: number;
  isActive: boolean;
  fields?: { sections: TemplateField[] };
  createdAt: string;
  updatedAt: string;
}

export interface TemplateField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'number' | 'select';
  required: boolean;
  options?: string[];
}

export interface DocumentSignature {
  id: string;
  documentId: string;
  personId: string;
  signRole: SignatureRole;
  status: SignatureStatus;
  signedAt?: string;
  comment?: string;
  person?: Person;
  sortOrder: number;
  createdAt: string;
}

export interface Journal {
  id: string;
  projectId: string;
  journalType: JournalType;
  title: string;
  startDate?: string;
  endDate?: string;
  status: JournalStatus;
  entries?: JournalEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntry {
  id: string;
  journalId: string;
  entryNumber: number;
  entryDate: string;
  weatherConditions?: string;
  temperature?: string;
  crewInfo?: string;
  workDescription: string;
  materialsUsed?: string;
  controlActions?: string;
  notes?: string;
  authorId: string;
  author?: Person;
  locationId?: string;
  location?: Location;
  workItemId?: string;
  workItem?: WorkItem;
  documentLinks?: { documentId: string; document?: Document }[];
  attachments?: Attachment[];
  createdAt: string;
  updatedAt: string;
}

export interface Package {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  periodFrom?: string;
  periodTo?: string;
  status: PackageStatus;
  filePath?: string;
  opisPath?: string;
  items?: PackageItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PackageItem {
  id: string;
  packageId: string;
  documentId: string;
  document?: Document;
  folderPath: string;
  sortOrder: number;
}

export interface DocumentMatrixRule {
  id: string;
  projectId?: string;
  workType: WorkType;
  documentType: DocumentType;
  triggerEvent: string;
  preparedByRole: ProjectMemberRole;
  checkedByRole?: ProjectMemberRole;
  signedByRoles: ProjectMemberRole[];
  requiredAttachments?: string[];
  requiredFields?: string[];
  linkedJournalType?: JournalType;
  isActive: boolean;
  sortOrder: number;
}

export interface Attachment {
  id: string;
  fileName: string;
  originalName: string;
  filePath: string;
  mimeType?: string;
  fileSize?: number;
  description?: string;
  category: AttachmentCategory;
  documentId?: string;
  journalEntryId?: string;
  createdAt: string;
}

export interface WorkflowTransition {
  id: string;
  documentId: string;
  fromStatus: DocumentStatus;
  toStatus: DocumentStatus;
  performedById: string;
  performedBy?: Person;
  comment?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  performedById?: string;
  performedBy?: Person;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

// ========== Permissions ==========

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

export type PermissionModule =
  | 'dashboard'
  | 'documents'
  | 'materials'
  | 'journals'
  | 'tasks'
  | 'corrections'
  | 'packages'
  | 'templates'
  | 'categories'
  | 'team'
  | 'matrix'
  | 'progress'
  | 'admin';

export interface ModulePermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export type UserPermissions = Record<PermissionModule, ModulePermissions>;

export interface AdminUser {
  id: string;
  fio: string;
  position?: string;
  role: UserRole;
  email: string;
  phone?: string;
  permissions: UserPermissions;
  organizationId?: string;
  organization?: { id: string; name: string; shortName?: string };
  createdAt: string;
  _count?: { projectMembers: number };
}

// ========== API Response Types ==========

export interface LoginResponse {
  token: string;
  user: User;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DashboardSummary {
  project: Pick<Project, 'id' | 'name' | 'code' | 'status' | 'startDate' | 'plannedEndDate'>;
  documentCounts: Record<DocumentStatus, number>;
  workItemCounts: Record<WorkItemStatus, number>;
  materialCount: number;
  journalEntryCount: number;
  pendingSignatures: number;
  recentDocuments: Document[];
  recentEntries: JournalEntry[];
}

export interface MatrixCell {
  locationId: string;
  documentType: DocumentType;
  status: DocumentStatus | 'MISSING';
  documentId?: string;
  documentNumber?: string;
}

export interface MatrixRule {
  id: string;
  projectId?: string;
  workType: string;
  documentType: string;
  triggerEvent: string;
  preparedByRole: string;
  checkedByRole?: string;
  signedByRoles: string[];
  isActive: boolean;
  sortOrder: number;
}

export interface MatrixData {
  rules: MatrixRule[];
  locations: Location[];
  documentTypes: string[];
  cells: MatrixCell[];
}

export interface AttentionItem {
  type: 'pending_signature' | 'missing_cert' | 'upcoming_test' | 'overdue';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
}

export interface DashboardStats {
  totalDocuments: number;
  signedDocuments: number;
  pendingDocuments: number;
  missingCertificates: number;
  recentActivity: (AuditLog & { user?: { fullName?: string } })[];
  attentionItems: AttentionItem[];
}

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER', 'ENGINEER', 'TECH_SUPERVISOR', 'AUTHOR_SUPERVISOR', 'LAB_TECHNICIAN', 'SUPPLIER', 'HSE_OFFICER');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('NEW_CONSTRUCTION', 'RECONSTRUCTION', 'CAPITAL_REPAIR', 'INTERIOR_FINISHING');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectMemberRole" AS ENUM ('RESPONSIBLE_PRODUCER', 'SITE_CHIEF', 'QA_ENGINEER', 'TECH_SUPERVISOR_REP', 'AUTHOR_SUPERVISOR_REP', 'HSE_RESPONSIBLE', 'OTHER');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('BUILDING', 'SECTION', 'FLOOR', 'ROOM', 'ZONE', 'AXIS');

-- CreateEnum
CREATE TYPE "WorkType" AS ENUM ('CONCRETE', 'REINFORCEMENT', 'STEEL_STRUCTURE', 'MASONRY', 'WATERPROOFING', 'INSULATION', 'ROOFING', 'PLASTERING', 'PAINTING', 'TILING', 'FLOORING', 'HVAC', 'PLUMBING', 'ELECTRICAL', 'FIRE_PROTECTION', 'LOW_VOLTAGE', 'GEODETIC', 'EARTHWORK', 'FOUNDATION', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkItemStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "CertificateType" AS ENUM ('PASSPORT', 'CONFORMITY_CERT', 'DECLARATION', 'TEST_REPORT', 'QUALITY_CERT', 'FIRE_CERT', 'SANITARY_CERT', 'OTHER');

-- CreateEnum
CREATE TYPE "ControlResult" AS ENUM ('ACCEPTED', 'REJECTED', 'CONDITIONALLY_ACCEPTED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('SITE_HANDOVER', 'ASSIGNMENT_ORDER', 'HSE_BRIEFING', 'PPR_UPLOAD', 'KICKOFF_PROTOCOL', 'AOSR', 'AOOK', 'NETWORK_ACT', 'GEODETIC_ACT', 'EXECUTIVE_DRAWING', 'INCOMING_CONTROL_ACT', 'MATERIAL_CERTIFICATE', 'TEST_PROTOCOL', 'INTERIM_ACCEPTANCE', 'DEFECT_LIST', 'COMPLETION_ACT', 'ID_HANDOVER', 'CORRESPONDENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'REVISION_REQUESTED', 'PENDING_SIGNATURE', 'SIGNED', 'ARCHIVED', 'IN_PACKAGE');

-- CreateEnum
CREATE TYPE "SignatureRole" AS ENUM ('PREPARED_BY', 'CHECKED_BY', 'APPROVED_BY', 'CONTRACTOR', 'CLIENT_REP', 'TECH_SUPERVISOR', 'AUTHOR_SUPERVISOR');

-- CreateEnum
CREATE TYPE "SignatureStatus" AS ENUM ('PENDING', 'SIGNED', 'REJECTED', 'DELEGATED');

-- CreateEnum
CREATE TYPE "JournalType" AS ENUM ('GENERAL', 'CONCRETE', 'WELDING', 'ANTICORROSION', 'INSULATION', 'PILE_DRIVING', 'GEODETIC', 'INSTALLATION', 'OTHER');

-- CreateEnum
CREATE TYPE "JournalStatus" AS ENUM ('ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AttachmentCategory" AS ENUM ('PHOTO', 'DRAWING', 'CERTIFICATE', 'PROTOCOL', 'SCHEME', 'CORRESPONDENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'SIGN', 'REJECT', 'EXPORT', 'PACKAGE');

-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('DRAFT', 'GENERATING', 'READY', 'DELIVERED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "inn" TEXT,
    "kpp" TEXT,
    "ogrn" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" UUID NOT NULL,
    "fio" TEXT NOT NULL,
    "position" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'ENGINEER',
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "sroNumber" TEXT,
    "sroOrg" TEXT,
    "certificateInfo" TEXT,
    "organizationId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "contractNumber" TEXT,
    "contractDate" TIMESTAMP(3),
    "projectType" "ProjectType" NOT NULL DEFAULT 'NEW_CONSTRUCTION',
    "startDate" TIMESTAMP(3),
    "plannedEndDate" TIMESTAMP(3),
    "normativeSet" TEXT NOT NULL DEFAULT 'СП 48.13330.2019, РД-11-02-2006, РД 11-05-2007',
    "documentLang" TEXT NOT NULL DEFAULT 'RU',
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "clientOrgId" UUID,
    "generalOrgId" UUID,
    "subOrgId" UUID,
    "designOrgId" UUID,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "personId" UUID NOT NULL,
    "projectRole" "ProjectMemberRole" NOT NULL,
    "canSign" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "parentId" UUID,
    "name" TEXT NOT NULL,
    "locationType" "LocationType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "locationId" UUID,
    "parentId" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workType" "WorkType" NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "quantity" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "WorkItemStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "manufacturer" TEXT,
    "batchNumber" TEXT,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "arrivalDate" TIMESTAMP(3),
    "deliveryNote" TEXT,
    "supplierId" UUID,
    "locationId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialCertificate" (
    "id" UUID NOT NULL,
    "materialId" UUID NOT NULL,
    "certType" "CertificateType" NOT NULL,
    "certNumber" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "issuedBy" TEXT,
    "filePath" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomingControl" (
    "id" UUID NOT NULL,
    "materialId" UUID NOT NULL,
    "controlDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inspectorId" UUID NOT NULL,
    "result" "ControlResult" NOT NULL,
    "visualCheck" TEXT,
    "measurements" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomingControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialUsage" (
    "id" UUID NOT NULL,
    "materialId" UUID NOT NULL,
    "workItemId" UUID NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "usedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "templateId" UUID,
    "documentType" "DocumentType" NOT NULL,
    "documentNumber" TEXT,
    "title" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "parentDocId" UUID,
    "locationId" UUID,
    "workItemId" UUID,
    "data" JSONB,
    "filePath" TEXT,
    "fileName" TEXT,
    "createdById" UUID NOT NULL,
    "documentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "description" TEXT,
    "filePath" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "fields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSignature" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "personId" UUID NOT NULL,
    "signRole" "SignatureRole" NOT NULL,
    "status" "SignatureStatus" NOT NULL DEFAULT 'PENDING',
    "signedAt" TIMESTAMP(3),
    "comment" TEXT,
    "stampData" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Journal" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "journalType" "JournalType" NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" "JournalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Journal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" UUID NOT NULL,
    "journalId" UUID NOT NULL,
    "entryNumber" INTEGER NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "weatherConditions" TEXT,
    "temperature" TEXT,
    "crewInfo" TEXT,
    "workDescription" TEXT NOT NULL,
    "materialsUsed" TEXT,
    "controlActions" TEXT,
    "notes" TEXT,
    "authorId" UUID NOT NULL,
    "locationId" UUID,
    "workItemId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntryDocLink" (
    "id" UUID NOT NULL,
    "journalEntryId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntryDocLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestProtocol" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "workItemId" UUID,
    "testType" TEXT NOT NULL,
    "protocolNumber" TEXT,
    "testDate" TIMESTAMP(3) NOT NULL,
    "equipment" TEXT,
    "calibrationInfo" TEXT,
    "standard" TEXT,
    "result" TEXT NOT NULL,
    "acceptanceCriteria" TEXT,
    "passed" BOOLEAN NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestProtocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "description" TEXT,
    "category" "AttachmentCategory" NOT NULL DEFAULT 'OTHER',
    "documentId" UUID,
    "journalEntryId" UUID,
    "testProtocolId" UUID,
    "incomingControlId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTransition" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "fromStatus" "DocumentStatus" NOT NULL,
    "toStatus" "DocumentStatus" NOT NULL,
    "performedById" UUID NOT NULL,
    "comment" TEXT,
    "changedFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "performedById" UUID,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Package" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "periodFrom" TIMESTAMP(3),
    "periodTo" TIMESTAMP(3),
    "status" "PackageStatus" NOT NULL DEFAULT 'DRAFT',
    "filePath" TEXT,
    "opisPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageItem" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "folderPath" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentMatrixRule" (
    "id" UUID NOT NULL,
    "projectId" UUID,
    "workType" "WorkType" NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "preparedByRole" "ProjectMemberRole" NOT NULL,
    "checkedByRole" "ProjectMemberRole",
    "signedByRoles" JSONB NOT NULL,
    "requiredAttachments" JSONB,
    "requiredFields" JSONB,
    "linkedJournalType" "JournalType",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentMatrixRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraints
CREATE UNIQUE INDEX "Person_email_key" ON "Person"("email");

CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

CREATE UNIQUE INDEX "ProjectMember_projectId_personId_projectRole_key" ON "ProjectMember"("projectId", "personId", "projectRole");

CREATE UNIQUE INDEX "MaterialUsage_materialId_workItemId_key" ON "MaterialUsage"("materialId", "workItemId");

CREATE UNIQUE INDEX "JournalEntryDocLink_journalEntryId_documentId_key" ON "JournalEntryDocLink"("journalEntryId", "documentId");

CREATE UNIQUE INDEX "PackageItem_packageId_documentId_key" ON "PackageItem"("packageId", "documentId");

-- CreateIndex: Foreign key indexes
CREATE INDEX "Person_organizationId_idx" ON "Person"("organizationId");

CREATE INDEX "Project_clientOrgId_idx" ON "Project"("clientOrgId");
CREATE INDEX "Project_generalOrgId_idx" ON "Project"("generalOrgId");
CREATE INDEX "Project_subOrgId_idx" ON "Project"("subOrgId");
CREATE INDEX "Project_designOrgId_idx" ON "Project"("designOrgId");

CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");
CREATE INDEX "ProjectMember_personId_idx" ON "ProjectMember"("personId");

CREATE INDEX "Location_projectId_idx" ON "Location"("projectId");
CREATE INDEX "Location_parentId_idx" ON "Location"("parentId");

CREATE INDEX "WorkItem_projectId_idx" ON "WorkItem"("projectId");
CREATE INDEX "WorkItem_locationId_idx" ON "WorkItem"("locationId");
CREATE INDEX "WorkItem_parentId_idx" ON "WorkItem"("parentId");

CREATE INDEX "Material_projectId_idx" ON "Material"("projectId");
CREATE INDEX "Material_supplierId_idx" ON "Material"("supplierId");
CREATE INDEX "Material_locationId_idx" ON "Material"("locationId");

CREATE INDEX "MaterialCertificate_materialId_idx" ON "MaterialCertificate"("materialId");

CREATE INDEX "IncomingControl_materialId_idx" ON "IncomingControl"("materialId");
CREATE INDEX "IncomingControl_inspectorId_idx" ON "IncomingControl"("inspectorId");

CREATE INDEX "MaterialUsage_materialId_idx" ON "MaterialUsage"("materialId");
CREATE INDEX "MaterialUsage_workItemId_idx" ON "MaterialUsage"("workItemId");

CREATE INDEX "Document_projectId_idx" ON "Document"("projectId");
CREATE INDEX "Document_templateId_idx" ON "Document"("templateId");
CREATE INDEX "Document_parentDocId_idx" ON "Document"("parentDocId");
CREATE INDEX "Document_locationId_idx" ON "Document"("locationId");
CREATE INDEX "Document_workItemId_idx" ON "Document"("workItemId");
CREATE INDEX "Document_createdById_idx" ON "Document"("createdById");

CREATE INDEX "DocumentSignature_documentId_idx" ON "DocumentSignature"("documentId");
CREATE INDEX "DocumentSignature_personId_idx" ON "DocumentSignature"("personId");

CREATE INDEX "Journal_projectId_idx" ON "Journal"("projectId");

CREATE INDEX "JournalEntry_journalId_idx" ON "JournalEntry"("journalId");
CREATE INDEX "JournalEntry_authorId_idx" ON "JournalEntry"("authorId");
CREATE INDEX "JournalEntry_locationId_idx" ON "JournalEntry"("locationId");
CREATE INDEX "JournalEntry_workItemId_idx" ON "JournalEntry"("workItemId");

CREATE INDEX "JournalEntryDocLink_journalEntryId_idx" ON "JournalEntryDocLink"("journalEntryId");
CREATE INDEX "JournalEntryDocLink_documentId_idx" ON "JournalEntryDocLink"("documentId");

CREATE INDEX "TestProtocol_workItemId_idx" ON "TestProtocol"("workItemId");

CREATE INDEX "Attachment_documentId_idx" ON "Attachment"("documentId");
CREATE INDEX "Attachment_journalEntryId_idx" ON "Attachment"("journalEntryId");
CREATE INDEX "Attachment_testProtocolId_idx" ON "Attachment"("testProtocolId");
CREATE INDEX "Attachment_incomingControlId_idx" ON "Attachment"("incomingControlId");

CREATE INDEX "WorkflowTransition_documentId_idx" ON "WorkflowTransition"("documentId");
CREATE INDEX "WorkflowTransition_performedById_idx" ON "WorkflowTransition"("performedById");

CREATE INDEX "AuditLog_performedById_idx" ON "AuditLog"("performedById");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

CREATE INDEX "Package_projectId_idx" ON "Package"("projectId");

CREATE INDEX "PackageItem_packageId_idx" ON "PackageItem"("packageId");
CREATE INDEX "PackageItem_documentId_idx" ON "PackageItem"("documentId");

CREATE INDEX "DocumentMatrixRule_projectId_idx" ON "DocumentMatrixRule"("projectId");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Project" ADD CONSTRAINT "Project_clientOrgId_fkey" FOREIGN KEY ("clientOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_generalOrgId_fkey" FOREIGN KEY ("generalOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_subOrgId_fkey" FOREIGN KEY ("subOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_designOrgId_fkey" FOREIGN KEY ("designOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Location" ADD CONSTRAINT "Location_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Location" ADD CONSTRAINT "Location_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Material" ADD CONSTRAINT "Material_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Material" ADD CONSTRAINT "Material_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Material" ADD CONSTRAINT "Material_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MaterialCertificate" ADD CONSTRAINT "MaterialCertificate_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IncomingControl" ADD CONSTRAINT "IncomingControl_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IncomingControl" ADD CONSTRAINT "IncomingControl_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaterialUsage" ADD CONSTRAINT "MaterialUsage_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialUsage" ADD CONSTRAINT "MaterialUsage_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_parentDocId_fkey" FOREIGN KEY ("parentDocId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DocumentSignature" ADD CONSTRAINT "DocumentSignature_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentSignature" ADD CONSTRAINT "DocumentSignature_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Journal" ADD CONSTRAINT "Journal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JournalEntryDocLink" ADD CONSTRAINT "JournalEntryDocLink_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalEntryDocLink" ADD CONSTRAINT "JournalEntryDocLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TestProtocol" ADD CONSTRAINT "TestProtocol_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_testProtocolId_fkey" FOREIGN KEY ("testProtocolId") REFERENCES "TestProtocol"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_incomingControlId_fkey" FOREIGN KEY ("incomingControlId") REFERENCES "IncomingControl"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Package" ADD CONSTRAINT "Package_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PackageItem" ADD CONSTRAINT "PackageItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PackageItem" ADD CONSTRAINT "PackageItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DocumentMatrixRule" ADD CONSTRAINT "DocumentMatrixRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

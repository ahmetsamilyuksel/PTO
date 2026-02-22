-- Add missing enums
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE');
CREATE TYPE "TaskAssignmentStatus" AS ENUM ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');
CREATE TYPE "ErrorType" AS ENUM ('DATA_ERROR', 'FORMAT_ERROR', 'MISSING_INFO', 'WRONG_REFERENCE', 'SIGNATURE_ERROR', 'DATE_ERROR', 'CALCULATION_ERROR', 'OTHER');
CREATE TYPE "ErrorSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "CorrectionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'VERIFIED', 'CLOSED', 'REOPENED');
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'CANCELLED');

-- Update AuditAction enum to add missing values
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TASK_ASSIGN';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CORRECTION';

-- Add permissions column to Person
ALTER TABLE "Person" ADD COLUMN IF NOT EXISTS "permissions" JSONB;

-- Add custom category/template columns to Document
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "customCategoryId" UUID;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "customTemplateId" UUID;

-- CreateTable: CustomCategory
CREATE TABLE IF NOT EXISTS "CustomCategory" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "parentId" UUID,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CustomCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CustomTemplate
CREATE TABLE IF NOT EXISTS "CustomTemplate" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "documentType" "DocumentType",
    "categoryId" TEXT,
    "filePath" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "fields" JSONB,
    "format" TEXT DEFAULT 'DOCX',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CustomTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Task
CREATE TABLE IF NOT EXISTS "Task" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "reminderDate" TIMESTAMP(3),
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "relatedDocId" UUID,
    "createdById" UUID NOT NULL,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TaskAssignment
CREATE TABLE IF NOT EXISTS "TaskAssignment" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "assigneeId" UUID NOT NULL,
    "assignedById" UUID NOT NULL,
    "status" "TaskAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "comment" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DocumentCorrection
CREATE TABLE IF NOT EXISTS "DocumentCorrection" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "errorType" "ErrorType" NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "ErrorSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "CorrectionStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToId" UUID,
    "reportedById" UUID NOT NULL,
    "resolvedById" UUID,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CorrectionComment
CREATE TABLE IF NOT EXISTS "CorrectionComment" (
    "id" UUID NOT NULL,
    "correctionId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorrectionComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ProjectMilestone
CREATE TABLE IF NOT EXISTS "ProjectMilestone" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "CustomCategory_projectId_code_key" ON "CustomCategory"("projectId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "TaskAssignment_taskId_assigneeId_key" ON "TaskAssignment"("taskId", "assigneeId");

-- CreateIndex: Foreign key indexes
CREATE INDEX IF NOT EXISTS "CustomCategory_projectId_idx" ON "CustomCategory"("projectId");
CREATE INDEX IF NOT EXISTS "CustomCategory_parentId_idx" ON "CustomCategory"("parentId");

CREATE INDEX IF NOT EXISTS "CustomTemplate_projectId_idx" ON "CustomTemplate"("projectId");
CREATE INDEX IF NOT EXISTS "CustomTemplate_createdById_idx" ON "CustomTemplate"("createdById");

CREATE INDEX IF NOT EXISTS "Task_projectId_idx" ON "Task"("projectId");
CREATE INDEX IF NOT EXISTS "Task_relatedDocId_idx" ON "Task"("relatedDocId");
CREATE INDEX IF NOT EXISTS "Task_createdById_idx" ON "Task"("createdById");

CREATE INDEX IF NOT EXISTS "TaskAssignment_taskId_idx" ON "TaskAssignment"("taskId");
CREATE INDEX IF NOT EXISTS "TaskAssignment_assigneeId_idx" ON "TaskAssignment"("assigneeId");
CREATE INDEX IF NOT EXISTS "TaskAssignment_assignedById_idx" ON "TaskAssignment"("assignedById");

CREATE INDEX IF NOT EXISTS "DocumentCorrection_documentId_idx" ON "DocumentCorrection"("documentId");
CREATE INDEX IF NOT EXISTS "DocumentCorrection_projectId_idx" ON "DocumentCorrection"("projectId");
CREATE INDEX IF NOT EXISTS "DocumentCorrection_assignedToId_idx" ON "DocumentCorrection"("assignedToId");
CREATE INDEX IF NOT EXISTS "DocumentCorrection_reportedById_idx" ON "DocumentCorrection"("reportedById");
CREATE INDEX IF NOT EXISTS "DocumentCorrection_resolvedById_idx" ON "DocumentCorrection"("resolvedById");

CREATE INDEX IF NOT EXISTS "CorrectionComment_correctionId_idx" ON "CorrectionComment"("correctionId");
CREATE INDEX IF NOT EXISTS "CorrectionComment_authorId_idx" ON "CorrectionComment"("authorId");

CREATE INDEX IF NOT EXISTS "ProjectMilestone_projectId_idx" ON "ProjectMilestone"("projectId");

CREATE INDEX IF NOT EXISTS "Document_customCategoryId_idx" ON "Document"("customCategoryId");
CREATE INDEX IF NOT EXISTS "Document_customTemplateId_idx" ON "Document"("customTemplateId");

-- AddForeignKey: CustomCategory
ALTER TABLE "CustomCategory" ADD CONSTRAINT "CustomCategory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomCategory" ADD CONSTRAINT "CustomCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CustomCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: CustomTemplate
ALTER TABLE "CustomTemplate" ADD CONSTRAINT "CustomTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomTemplate" ADD CONSTRAINT "CustomTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Document -> CustomCategory, CustomTemplate
ALTER TABLE "Document" ADD CONSTRAINT "Document_customCategoryId_fkey" FOREIGN KEY ("customCategoryId") REFERENCES "CustomCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_customTemplateId_fkey" FOREIGN KEY ("customTemplateId") REFERENCES "CustomTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Task
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_relatedDocId_fkey" FOREIGN KEY ("relatedDocId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: TaskAssignment
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: DocumentCorrection
ALTER TABLE "DocumentCorrection" ADD CONSTRAINT "DocumentCorrection_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentCorrection" ADD CONSTRAINT "DocumentCorrection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentCorrection" ADD CONSTRAINT "DocumentCorrection_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentCorrection" ADD CONSTRAINT "DocumentCorrection_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentCorrection" ADD CONSTRAINT "DocumentCorrection_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: CorrectionComment
ALTER TABLE "CorrectionComment" ADD CONSTRAINT "CorrectionComment_correctionId_fkey" FOREIGN KEY ("correctionId") REFERENCES "DocumentCorrection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CorrectionComment" ADD CONSTRAINT "CorrectionComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: ProjectMilestone
ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

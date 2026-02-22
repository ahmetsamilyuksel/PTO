import { Router, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// ─── GET /api/dashboard/summary?projectId=... ───
router.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'Required parameter: projectId' });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId as string },
      select: { id: true, name: true, code: true, status: true, startDate: true, plannedEndDate: true },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Run all aggregation queries in parallel
    const [
      documentCounts,
      workItemCounts,
      materialCount,
      journalEntryCount,
      pendingSignatures,
      packageCounts,
      recentDocuments,
      recentEntries,
    ] = await Promise.all([
      // Document counts by status
      prisma.document.groupBy({
        by: ['status'],
        where: { projectId: projectId as string, deletedAt: null },
        _count: { id: true },
      }),

      // Work item counts by status
      prisma.workItem.groupBy({
        by: ['status'],
        where: { projectId: projectId as string, deletedAt: null },
        _count: { id: true },
      }),

      // Materials count
      prisma.material.count({
        where: { projectId: projectId as string, deletedAt: null },
      }),

      // Journal entries count (last 30 days)
      prisma.journalEntry.count({
        where: {
          journal: { projectId: projectId as string },
          entryDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),

      // Pending signatures for current user
      prisma.documentSignature.count({
        where: {
          personId: req.userId,
          status: 'PENDING',
          document: { projectId: projectId as string, deletedAt: null },
        },
      }),

      // Package counts by status
      prisma.package.groupBy({
        by: ['status'],
        where: { projectId: projectId as string },
        _count: { id: true },
      }),

      // Recent documents (last 10)
      prisma.document.findMany({
        where: { projectId: projectId as string, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          documentType: true,
          documentNumber: true,
          status: true,
          updatedAt: true,
          createdBy: { select: { id: true, fio: true } },
        },
      }),

      // Recent journal entries (last 10)
      prisma.journalEntry.findMany({
        where: { journal: { projectId: projectId as string } },
        orderBy: { entryDate: 'desc' },
        take: 10,
        select: {
          id: true,
          entryNumber: true,
          entryDate: true,
          workDescription: true,
          author: { select: { id: true, fio: true } },
          journal: { select: { id: true, title: true, journalType: true } },
        },
      }),
    ]);

    // Transform group counts into maps
    const docByStatus: Record<string, number> = {};
    documentCounts.forEach((g) => { docByStatus[g.status] = g._count.id; });

    const workByStatus: Record<string, number> = {};
    workItemCounts.forEach((g) => { workByStatus[g.status] = g._count.id; });

    const pkgByStatus: Record<string, number> = {};
    packageCounts.forEach((g) => { pkgByStatus[g.status] = g._count.id; });

    const totalDocuments = Object.values(docByStatus).reduce((a, b) => a + b, 0);
    const totalWorkItems = Object.values(workByStatus).reduce((a, b) => a + b, 0);

    return res.json({
      project,
      stats: {
        documents: {
          total: totalDocuments,
          byStatus: docByStatus,
          signedPercentage: totalDocuments > 0
            ? Math.round(((docByStatus['SIGNED'] || 0) + (docByStatus['IN_PACKAGE'] || 0)) / totalDocuments * 100)
            : 0,
        },
        workItems: {
          total: totalWorkItems,
          byStatus: workByStatus,
          completionPercentage: totalWorkItems > 0
            ? Math.round(((workByStatus['COMPLETED'] || 0) + (workByStatus['ACCEPTED'] || 0)) / totalWorkItems * 100)
            : 0,
        },
        materials: {
          total: materialCount,
        },
        journals: {
          recentEntries: journalEntryCount,
        },
        packages: {
          byStatus: pkgByStatus,
        },
        myPendingSignatures: pendingSignatures,
      },
      recent: {
        documents: recentDocuments,
        journalEntries: recentEntries,
      },
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    return res.status(500).json({ error: 'Error fetching project summary' });
  }
});

// ─── GET /api/dashboard/my-tasks ───
router.get('/my-tasks', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.query;

    const docWhere: any = {
      personId: req.userId,
      status: 'PENDING',
      document: { deletedAt: null },
    };
    if (projectId) {
      docWhere.document.projectId = projectId as string;
    }

    // Pending signatures
    const pendingSignatures = await prisma.documentSignature.findMany({
      where: docWhere,
      include: {
        document: {
          select: {
            id: true,
            title: true,
            documentType: true,
            documentNumber: true,
            status: true,
            project: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Documents in revision (created by me)
    const docsWhere: any = {
      createdById: req.userId,
      status: 'REVISION_REQUESTED',
      deletedAt: null,
    };
    if (projectId) docsWhere.projectId = projectId as string;

    const revisionDocuments = await prisma.document.findMany({
      where: docsWhere,
      select: {
        id: true,
        title: true,
        documentType: true,
        documentNumber: true,
        status: true,
        updatedAt: true,
        project: { select: { id: true, name: true, code: true } },
        workflowHistory: {
          where: { toStatus: 'REVISION_REQUESTED' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { comment: true, performedBy: { select: { fio: true } }, createdAt: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Draft documents (created by me)
    const draftWhere: any = {
      createdById: req.userId,
      status: 'DRAFT',
      deletedAt: null,
    };
    if (projectId) draftWhere.projectId = projectId as string;

    const draftDocuments = await prisma.document.findMany({
      where: draftWhere,
      select: {
        id: true,
        title: true,
        documentType: true,
        documentNumber: true,
        updatedAt: true,
        project: { select: { id: true, name: true, code: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    return res.json({
      pendingSignatures: pendingSignatures.map((sig) => ({
        signatureId: sig.id,
        signRole: sig.signRole,
        document: sig.document,
      })),
      revisionDocuments,
      draftDocuments,
      counts: {
        pendingSignatures: pendingSignatures.length,
        revisionDocuments: revisionDocuments.length,
        draftDocuments: draftDocuments.length,
      },
    });
  } catch (error) {
    console.error('My tasks error:', error);
    return res.status(500).json({ error: 'Error fetching my tasks' });
  }
});

// ─── GET /api/dashboard/document-stats?projectId=... ───
router.get('/document-stats', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'Required parameter: projectId' });
    }

    // Documents by type
    const byType = await prisma.document.groupBy({
      by: ['documentType'],
      where: { projectId: projectId as string, deletedAt: null },
      _count: { id: true },
    });

    // Documents by type and status
    const byTypeAndStatus = await prisma.document.groupBy({
      by: ['documentType', 'status'],
      where: { projectId: projectId as string, deletedAt: null },
      _count: { id: true },
    });

    // Documents created per week (last 12 weeks)
    const twelveWeeksAgo = new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000);
    const recentDocs = await prisma.document.findMany({
      where: {
        projectId: projectId as string,
        deletedAt: null,
        createdAt: { gte: twelveWeeksAgo },
      },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by week
    const weeklyCreated: Record<string, number> = {};
    const weeklySigned: Record<string, number> = {};
    recentDocs.forEach((doc) => {
      const weekStart = new Date(doc.createdAt);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      weeklyCreated[weekKey] = (weeklyCreated[weekKey] || 0) + 1;
      if (doc.status === 'SIGNED' || doc.status === 'IN_PACKAGE') {
        weeklySigned[weekKey] = (weeklySigned[weekKey] || 0) + 1;
      }
    });

    // Build type matrix
    const typeMatrix: Record<string, Record<string, number>> = {};
    byTypeAndStatus.forEach((g) => {
      if (!typeMatrix[g.documentType]) typeMatrix[g.documentType] = {};
      typeMatrix[g.documentType][g.status] = g._count.id;
    });

    return res.json({
      byType: byType.map((g) => ({ documentType: g.documentType, count: g._count.id })),
      typeMatrix,
      weeklyTrend: {
        created: weeklyCreated,
        signed: weeklySigned,
      },
    });
  } catch (error) {
    console.error('Document stats error:', error);
    return res.status(500).json({ error: 'Error fetching document statistics' });
  }
});

// ─── GET /api/dashboard/overview ───
// Global overview across all projects the user has access to
router.get('/overview', async (req: AuthRequest, res: Response) => {
  try {
    const projectFilter: any = { deletedAt: null };

    // Non-admin users see only their projects
    if (req.userRole !== 'ADMIN') {
      projectFilter.members = { some: { personId: req.userId } };
    }

    const [
      projectsByStatus,
      totalDocuments,
      totalPendingSignatures,
      recentActivity,
    ] = await Promise.all([
      // Projects by status
      prisma.project.groupBy({
        by: ['status'],
        where: projectFilter,
        _count: { id: true },
      }),

      // Total documents across all accessible projects
      prisma.document.count({
        where: {
          deletedAt: null,
          project: projectFilter,
        },
      }),

      // Pending signatures for current user
      prisma.documentSignature.count({
        where: {
          personId: req.userId,
          status: 'PENDING',
          document: { deletedAt: null },
        },
      }),

      // Recent activity (last 5 workflow transitions)
      prisma.workflowTransition.findMany({
        where: {
          document: {
            deletedAt: null,
            project: projectFilter,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          document: {
            select: {
              id: true,
              title: true,
              documentType: true,
              project: { select: { id: true, name: true, code: true } },
            },
          },
          performedBy: { select: { id: true, fio: true } },
        },
      }),
    ]);

    const projByStatus: Record<string, number> = {};
    projectsByStatus.forEach((g) => { projByStatus[g.status] = g._count.id; });

    return res.json({
      projects: {
        byStatus: projByStatus,
        total: Object.values(projByStatus).reduce((a, b) => a + b, 0),
      },
      totalDocuments,
      myPendingSignatures: totalPendingSignatures,
      recentActivity: recentActivity.map((t) => ({
        id: t.id,
        fromStatus: t.fromStatus,
        toStatus: t.toStatus,
        comment: t.comment,
        performedBy: t.performedBy,
        document: t.document,
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    console.error('Dashboard overview error:', error);
    return res.status(500).json({ error: 'Error fetching overall summary' });
  }
});

export default router;

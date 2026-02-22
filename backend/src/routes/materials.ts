import { Router, Response } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// ─── GET /api/materials?projectId=... ───
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      projectId, search, supplierId, locationId,
      page = '1', limit = '50',
    } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'Required parameter: projectId' });
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = { projectId: projectId as string, deletedAt: null };
    if (supplierId) where.supplierId = supplierId as string;
    if (locationId) where.locationId = locationId as string;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { brand: { contains: search as string, mode: 'insensitive' } },
        { manufacturer: { contains: search as string, mode: 'insensitive' } },
        { batchNumber: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [materials, total] = await Promise.all([
      prisma.material.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { id: true, name: true, shortName: true } },
          storageLocation: { select: { id: true, name: true } },
          _count: { select: { certificates: true, incomingControls: true, usages: true } },
        },
      }),
      prisma.material.count({ where }),
    ]);

    return res.json({ data: materials, total, page: parseInt(page as string), limit: take });
  } catch (error) {
    console.error('List materials error:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `Error fetching materials list: ${detail}` });
  }
});

// ─── GET /api/materials/:id ───
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const material = await prisma.material.findUnique({
      where: { id: req.params.id },
      include: {
        supplier: { select: { id: true, name: true, shortName: true } },
        storageLocation: { select: { id: true, name: true, locationType: true } },
        certificates: {
          orderBy: { createdAt: 'desc' },
        },
        incomingControls: {
          include: {
            inspector: { select: { id: true, fio: true, position: true } },
            photos: true,
          },
          orderBy: { controlDate: 'desc' },
        },
        usages: {
          include: {
            workItem: { select: { id: true, code: true, name: true, workType: true } },
          },
        },
      },
    });

    if (!material || material.deletedAt) {
      return res.status(404).json({ error: 'Material not found' });
    }

    return res.json(material);
  } catch (error) {
    console.error('Get material error:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `Error fetching material: ${detail}` });
  }
});

// ─── POST /api/materials ───
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      projectId, name, brand, manufacturer, batchNumber,
      quantity, unit, arrivalDate, deliveryNote,
      supplierId, locationId,
    } = req.body;

    if (!projectId || !name) {
      return res.status(400).json({ error: 'Required fields: projectId, name' });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.deletedAt) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const material = await prisma.material.create({
      data: {
        projectId,
        name,
        brand: brand || null,
        manufacturer: manufacturer || null,
        batchNumber: batchNumber || null,
        quantity: quantity || null,
        unit: unit || null,
        arrivalDate: arrivalDate ? new Date(arrivalDate) : null,
        deliveryNote: deliveryNote || null,
        supplierId: supplierId || null,
        locationId: locationId || null,
      },
    });

    return res.status(201).json(material);
  } catch (error) {
    console.error('Create material error:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `Error creating material: ${detail}` });
  }
});

// ─── PUT /api/materials/:id ───
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.material.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: 'Material not found' });
    }

    const {
      name, brand, manufacturer, batchNumber,
      quantity, unit, arrivalDate, deliveryNote,
      supplierId, locationId,
    } = req.body;

    const material = await prisma.material.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(brand !== undefined && { brand }),
        ...(manufacturer !== undefined && { manufacturer }),
        ...(batchNumber !== undefined && { batchNumber }),
        ...(quantity !== undefined && { quantity }),
        ...(unit !== undefined && { unit }),
        ...(arrivalDate !== undefined && { arrivalDate: arrivalDate ? new Date(arrivalDate) : null }),
        ...(deliveryNote !== undefined && { deliveryNote }),
        ...(supplierId !== undefined && { supplierId }),
        ...(locationId !== undefined && { locationId }),
      },
    });

    return res.json(material);
  } catch (error) {
    console.error('Update material error:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `Error updating material: ${detail}` });
  }
});

// ─── DELETE /api/materials/:id ───
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.material.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: 'Material not found' });
    }

    await prisma.material.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    return res.json({ message: 'Material deleted' });
  } catch (error) {
    console.error('Delete material error:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `Error deleting material: ${detail}` });
  }
});

// ═══════════════════════════════════════════════
// CERTIFICATES (sub-resource of materials)
// ═══════════════════════════════════════════════

// ─── GET /api/materials/:id/certificates ───
router.get('/:id/certificates', async (req: AuthRequest, res: Response) => {
  try {
    const material = await prisma.material.findUnique({ where: { id: req.params.id } });
    if (!material || material.deletedAt) {
      return res.status(404).json({ error: 'Material not found' });
    }

    const certificates = await prisma.materialCertificate.findMany({
      where: { materialId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ data: certificates });
  } catch (error) {
    console.error('List certificates error:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `Error fetching certificates: ${detail}` });
  }
});

// ─── POST /api/materials/:id/certificates ───
router.post('/:id/certificates', async (req: AuthRequest, res: Response) => {
  try {
    const material = await prisma.material.findUnique({ where: { id: req.params.id } });
    if (!material || material.deletedAt) {
      return res.status(404).json({ error: 'Material not found' });
    }

    const {
      certType, certNumber, issueDate, expiryDate,
      issuedBy, filePath, fileName, fileSize,
    } = req.body;

    if (!certType) {
      return res.status(400).json({ error: 'Required field: certType' });
    }

    const certificate = await prisma.materialCertificate.create({
      data: {
        materialId: req.params.id,
        certType,
        certNumber: certNumber || null,
        issueDate: issueDate ? new Date(issueDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        issuedBy: issuedBy || null,
        filePath: filePath || null,
        fileName: fileName || null,
        fileSize: fileSize || null,
      },
    });

    return res.status(201).json(certificate);
  } catch (error) {
    console.error('Create certificate error:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `Error creating certificate: ${detail}` });
  }
});

// ─── PUT /api/materials/:materialId/certificates/:certId ───
router.put('/:materialId/certificates/:certId', async (req: AuthRequest, res: Response) => {
  try {
    const cert = await prisma.materialCertificate.findUnique({ where: { id: req.params.certId } });
    if (!cert || cert.materialId !== req.params.materialId) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    const {
      certType, certNumber, issueDate, expiryDate,
      issuedBy, filePath, fileName, fileSize,
    } = req.body;

    const updated = await prisma.materialCertificate.update({
      where: { id: req.params.certId },
      data: {
        ...(certType !== undefined && { certType }),
        ...(certNumber !== undefined && { certNumber }),
        ...(issueDate !== undefined && { issueDate: issueDate ? new Date(issueDate) : null }),
        ...(expiryDate !== undefined && { expiryDate: expiryDate ? new Date(expiryDate) : null }),
        ...(issuedBy !== undefined && { issuedBy }),
        ...(filePath !== undefined && { filePath }),
        ...(fileName !== undefined && { fileName }),
        ...(fileSize !== undefined && { fileSize }),
      },
    });

    return res.json(updated);
  } catch (error) {
    console.error('Update certificate error:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `Error updating certificate: ${detail}` });
  }
});

// ─── DELETE /api/materials/:materialId/certificates/:certId ───
router.delete('/:materialId/certificates/:certId', async (req: AuthRequest, res: Response) => {
  try {
    const cert = await prisma.materialCertificate.findUnique({ where: { id: req.params.certId } });
    if (!cert || cert.materialId !== req.params.materialId) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    await prisma.materialCertificate.delete({ where: { id: req.params.certId } });

    return res.json({ message: 'Certificate deleted' });
  } catch (error) {
    console.error('Delete certificate error:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `Error deleting certificate: ${detail}` });
  }
});

// ═══════════════════════════════════════════════
// INCOMING CONTROL (sub-resource of materials)
// ═══════════════════════════════════════════════

// ─── GET /api/materials/:id/incoming-controls ───
router.get('/:id/incoming-controls', async (req: AuthRequest, res: Response) => {
  try {
    const material = await prisma.material.findUnique({ where: { id: req.params.id } });
    if (!material || material.deletedAt) {
      return res.status(404).json({ error: 'Material not found' });
    }

    const controls = await prisma.incomingControl.findMany({
      where: { materialId: req.params.id },
      include: {
        inspector: { select: { id: true, fio: true, position: true } },
        photos: true,
      },
      orderBy: { controlDate: 'desc' },
    });

    return res.json({ data: controls });
  } catch (error) {
    console.error('List incoming controls error:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `Error fetching incoming control records: ${detail}` });
  }
});

// ─── POST /api/materials/:id/incoming-controls ───
router.post('/:id/incoming-controls', async (req: AuthRequest, res: Response) => {
  try {
    const material = await prisma.material.findUnique({ where: { id: req.params.id } });
    if (!material || material.deletedAt) {
      return res.status(404).json({ error: 'Material not found' });
    }

    const {
      controlDate, inspectorId, result,
      visualCheck, measurements, notes,
    } = req.body;

    if (!result) {
      return res.status(400).json({ error: 'Required field: result (ACCEPTED, REJECTED, CONDITIONALLY_ACCEPTED)' });
    }

    const inspector = inspectorId || req.userId;
    const person = await prisma.person.findUnique({ where: { id: inspector } });
    if (!person || person.deletedAt) {
      return res.status(404).json({ error: 'Inspector not found' });
    }

    const control = await prisma.incomingControl.create({
      data: {
        materialId: req.params.id,
        controlDate: controlDate ? new Date(controlDate) : new Date(),
        inspectorId: inspector,
        result,
        visualCheck: visualCheck || null,
        measurements: measurements || null,
        notes: notes || null,
      },
      include: {
        inspector: { select: { id: true, fio: true, position: true } },
      },
    });

    return res.status(201).json(control);
  } catch (error) {
    console.error('Create incoming control error:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `Error creating incoming control record: ${detail}` });
  }
});

// ─── PUT /api/materials/:materialId/incoming-controls/:controlId ───
router.put('/:materialId/incoming-controls/:controlId', async (req: AuthRequest, res: Response) => {
  try {
    const control = await prisma.incomingControl.findUnique({ where: { id: req.params.controlId } });
    if (!control || control.materialId !== req.params.materialId) {
      return res.status(404).json({ error: 'Incoming control record not found' });
    }

    const {
      controlDate, result, visualCheck, measurements, notes,
    } = req.body;

    const updated = await prisma.incomingControl.update({
      where: { id: req.params.controlId },
      data: {
        ...(controlDate !== undefined && { controlDate: new Date(controlDate) }),
        ...(result !== undefined && { result }),
        ...(visualCheck !== undefined && { visualCheck }),
        ...(measurements !== undefined && { measurements }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        inspector: { select: { id: true, fio: true, position: true } },
      },
    });

    return res.json(updated);
  } catch (error) {
    console.error('Update incoming control error:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `Error updating incoming control record: ${detail}` });
  }
});

// ═══════════════════════════════════════════════
// MATERIAL USAGE (link material <-> work item)
// ═══════════════════════════════════════════════

// ─── POST /api/materials/:id/usages ───
router.post('/:id/usages', async (req: AuthRequest, res: Response) => {
  try {
    const material = await prisma.material.findUnique({ where: { id: req.params.id } });
    if (!material || material.deletedAt) {
      return res.status(404).json({ error: 'Material not found' });
    }

    const { workItemId, quantity, unit, usedDate } = req.body;

    if (!workItemId) {
      return res.status(400).json({ error: 'Required field: workItemId' });
    }

    const workItem = await prisma.workItem.findUnique({ where: { id: workItemId } });
    if (!workItem || workItem.deletedAt) {
      return res.status(404).json({ error: 'Work item not found' });
    }

    const usage = await prisma.materialUsage.create({
      data: {
        materialId: req.params.id,
        workItemId,
        quantity: quantity || null,
        unit: unit || null,
        usedDate: usedDate ? new Date(usedDate) : null,
      },
      include: {
        workItem: { select: { id: true, code: true, name: true } },
        material: { select: { id: true, name: true, brand: true } },
      },
    });

    return res.status(201).json(usage);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'Material is already linked to this work item' });
    }
    console.error('Create material usage error:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `Error linking material to work item: ${detail}` });
  }
});

// ─── DELETE /api/materials/:materialId/usages/:usageId ───
router.delete('/:materialId/usages/:usageId', async (req: AuthRequest, res: Response) => {
  try {
    const usage = await prisma.materialUsage.findUnique({ where: { id: req.params.usageId } });
    if (!usage || usage.materialId !== req.params.materialId) {
      return res.status(404).json({ error: 'Material-work item link not found' });
    }

    await prisma.materialUsage.delete({ where: { id: req.params.usageId } });

    return res.json({ message: 'Material-work item link deleted' });
  } catch (error) {
    console.error('Delete material usage error:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: `Error deleting material-work item link: ${detail}` });
  }
});

export default router;

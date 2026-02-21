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
      return res.status(400).json({ error: 'Обязательный параметр: projectId' });
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
    return res.status(500).json({ error: 'Ошибка при получении списка материалов' });
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
      return res.status(404).json({ error: 'Материал не найден' });
    }

    return res.json(material);
  } catch (error) {
    console.error('Get material error:', error);
    return res.status(500).json({ error: 'Ошибка при получении материала' });
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
      return res.status(400).json({ error: 'Обязательные поля: projectId, name' });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.deletedAt) {
      return res.status(404).json({ error: 'Проект не найден' });
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
    return res.status(500).json({ error: 'Ошибка при создании материала' });
  }
});

// ─── PUT /api/materials/:id ───
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.material.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: 'Материал не найден' });
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
    return res.status(500).json({ error: 'Ошибка при обновлении материала' });
  }
});

// ─── DELETE /api/materials/:id ───
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.material.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: 'Материал не найден' });
    }

    await prisma.material.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    return res.json({ message: 'Материал удалён' });
  } catch (error) {
    console.error('Delete material error:', error);
    return res.status(500).json({ error: 'Ошибка при удалении материала' });
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
      return res.status(404).json({ error: 'Материал не найден' });
    }

    const certificates = await prisma.materialCertificate.findMany({
      where: { materialId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ data: certificates });
  } catch (error) {
    console.error('List certificates error:', error);
    return res.status(500).json({ error: 'Ошибка при получении сертификатов' });
  }
});

// ─── POST /api/materials/:id/certificates ───
router.post('/:id/certificates', async (req: AuthRequest, res: Response) => {
  try {
    const material = await prisma.material.findUnique({ where: { id: req.params.id } });
    if (!material || material.deletedAt) {
      return res.status(404).json({ error: 'Материал не найден' });
    }

    const {
      certType, certNumber, issueDate, expiryDate,
      issuedBy, filePath, fileName, fileSize,
    } = req.body;

    if (!certType) {
      return res.status(400).json({ error: 'Обязательное поле: certType' });
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
    return res.status(500).json({ error: 'Ошибка при создании сертификата' });
  }
});

// ─── PUT /api/materials/:materialId/certificates/:certId ───
router.put('/:materialId/certificates/:certId', async (req: AuthRequest, res: Response) => {
  try {
    const cert = await prisma.materialCertificate.findUnique({ where: { id: req.params.certId } });
    if (!cert || cert.materialId !== req.params.materialId) {
      return res.status(404).json({ error: 'Сертификат не найден' });
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
    return res.status(500).json({ error: 'Ошибка при обновлении сертификата' });
  }
});

// ─── DELETE /api/materials/:materialId/certificates/:certId ───
router.delete('/:materialId/certificates/:certId', async (req: AuthRequest, res: Response) => {
  try {
    const cert = await prisma.materialCertificate.findUnique({ where: { id: req.params.certId } });
    if (!cert || cert.materialId !== req.params.materialId) {
      return res.status(404).json({ error: 'Сертификат не найден' });
    }

    await prisma.materialCertificate.delete({ where: { id: req.params.certId } });

    return res.json({ message: 'Сертификат удалён' });
  } catch (error) {
    console.error('Delete certificate error:', error);
    return res.status(500).json({ error: 'Ошибка при удалении сертификата' });
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
      return res.status(404).json({ error: 'Материал не найден' });
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
    return res.status(500).json({ error: 'Ошибка при получении записей входного контроля' });
  }
});

// ─── POST /api/materials/:id/incoming-controls ───
router.post('/:id/incoming-controls', async (req: AuthRequest, res: Response) => {
  try {
    const material = await prisma.material.findUnique({ where: { id: req.params.id } });
    if (!material || material.deletedAt) {
      return res.status(404).json({ error: 'Материал не найден' });
    }

    const {
      controlDate, inspectorId, result,
      visualCheck, measurements, notes,
    } = req.body;

    if (!result) {
      return res.status(400).json({ error: 'Обязательное поле: result (ACCEPTED, REJECTED, CONDITIONALLY_ACCEPTED)' });
    }

    const inspector = inspectorId || req.userId;
    const person = await prisma.person.findUnique({ where: { id: inspector } });
    if (!person || person.deletedAt) {
      return res.status(404).json({ error: 'Инспектор не найден' });
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
    return res.status(500).json({ error: 'Ошибка при создании записи входного контроля' });
  }
});

// ─── PUT /api/materials/:materialId/incoming-controls/:controlId ───
router.put('/:materialId/incoming-controls/:controlId', async (req: AuthRequest, res: Response) => {
  try {
    const control = await prisma.incomingControl.findUnique({ where: { id: req.params.controlId } });
    if (!control || control.materialId !== req.params.materialId) {
      return res.status(404).json({ error: 'Запись входного контроля не найдена' });
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
    return res.status(500).json({ error: 'Ошибка при обновлении записи входного контроля' });
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
      return res.status(404).json({ error: 'Материал не найден' });
    }

    const { workItemId, quantity, unit, usedDate } = req.body;

    if (!workItemId) {
      return res.status(400).json({ error: 'Обязательное поле: workItemId' });
    }

    const workItem = await prisma.workItem.findUnique({ where: { id: workItemId } });
    if (!workItem || workItem.deletedAt) {
      return res.status(404).json({ error: 'Работа не найдена' });
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
      return res.status(409).json({ error: 'Связь материала с данной работой уже существует' });
    }
    console.error('Create material usage error:', error);
    return res.status(500).json({ error: 'Ошибка при привязке материала к работе' });
  }
});

// ─── DELETE /api/materials/:materialId/usages/:usageId ───
router.delete('/:materialId/usages/:usageId', async (req: AuthRequest, res: Response) => {
  try {
    const usage = await prisma.materialUsage.findUnique({ where: { id: req.params.usageId } });
    if (!usage || usage.materialId !== req.params.materialId) {
      return res.status(404).json({ error: 'Связь материала с работой не найдена' });
    }

    await prisma.materialUsage.delete({ where: { id: req.params.usageId } });

    return res.json({ message: 'Связь материала с работой удалена' });
  } catch (error) {
    console.error('Delete material usage error:', error);
    return res.status(500).json({ error: 'Ошибка при удалении связи материала с работой' });
  }
});

export default router;

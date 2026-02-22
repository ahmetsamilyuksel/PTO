import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Tag, Select, Space, Typography, Spin, Card, Tooltip, Badge,
  Row, Col, Button, message, Empty,
} from 'antd';
import { FileAddOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import apiClient, { getApiError } from '../api/client';
import type { MatrixData, MatrixCell, MatrixRule, Location, Document } from '../types';
import { useI18n } from '../i18n';

const { Title } = Typography;

interface MatrixRow {
  key: string;
  documentType: string;
  [locationId: string]: string | MatrixCell | undefined;
}

const DocumentMatrix: React.FC = () => {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();

  const statusConfig: Record<string, { color: string; label: string; badgeStatus: 'success' | 'processing' | 'warning' | 'error' | 'default' }> = {
    MISSING: { color: '#ff4d4f', label: t.matrix?.missing || 'Eksik', badgeStatus: 'error' },
    DRAFT: { color: '#faad14', label: t.matrix?.draft || 'Taslak', badgeStatus: 'warning' },
    IN_REVIEW: { color: '#1677ff', label: t.matrix?.inReview || 'İncelemede', badgeStatus: 'processing' },
    PENDING_SIGNATURE: { color: '#722ed1', label: t.doc?.statuses?.PENDING_SIGNATURE || 'İmza Bekliyor', badgeStatus: 'processing' },
    SIGNED: { color: '#52c41a', label: t.matrix?.signed || 'İmzalı', badgeStatus: 'success' },
    REJECTED: { color: '#ff4d4f', label: t.doc?.statuses?.REVISION_REQUESTED || 'Reddedildi', badgeStatus: 'error' },
    ARCHIVED: { color: '#8c8c8c', label: t.project?.statuses?.ARCHIVED || 'Arşiv', badgeStatus: 'default' },
  };

  const [matrixData, setMatrixData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterWorkType, setFilterWorkType] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();

  const fetchMatrix = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      // Fetch rules, locations, and documents in parallel
      const [rulesRes, locsRes, docsRes] = await Promise.all([
        apiClient.get('/matrix', { params: { projectId } }),
        apiClient.get('/locations', { params: { projectId } }).catch(() => ({ data: [] })),
        apiClient.get('/documents', { params: { projectId, limit: '10000' } }).catch(() => ({ data: { data: [] } })),
      ]);

      const rules: MatrixRule[] = rulesRes.data?.data || rulesRes.data || [];
      const rawLocations: Location[] = locsRes.data?.data || locsRes.data || [];
      const documents: Document[] = docsRes.data?.data || docsRes.data || [];

      // Filter rules by workType if filter is active
      const filteredRules = filterWorkType
        ? rules.filter((r) => r.workType === filterWorkType)
        : rules;

      // Extract unique document types from rules
      const documentTypes = [...new Set(filteredRules.map((r) => r.documentType))];

      // Flatten locations for the matrix
      const flatLocs = flattenLocations(rawLocations);

      // Compute cells: for each documentType+location pair, find matching documents
      const cells: MatrixCell[] = [];
      for (const dt of documentTypes) {
        for (const loc of flatLocs) {
          const doc = documents.find(
            (d) => d.documentType === dt && d.locationId === loc.id
          );
          if (doc) {
            cells.push({
              locationId: loc.id,
              documentType: dt as MatrixCell['documentType'],
              status: doc.status,
              documentId: doc.id,
              documentNumber: doc.documentNumber || doc.number,
            });
          }
          // If no doc found, the cell is MISSING (handled in render)
        }
      }

      // Filter cells by status if filter is active
      const filteredCells = filterStatus
        ? cells.filter((c) => c.status === filterStatus)
        : cells;

      setMatrixData({
        rules: filteredRules,
        locations: rawLocations,
        documentTypes,
        cells: filterStatus ? filteredCells : cells,
      });
    } catch (error: unknown) {
      const msg = getApiError(error, t.app.error);
      if (msg) message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [projectId, filterWorkType, filterStatus]);

  useEffect(() => { fetchMatrix(); }, [fetchMatrix]);

  const flattenLocations = (locs: Location[]): Location[] => {
    const result: Location[] = [];
    const flatten = (items: Location[]) => {
      items.forEach((item) => {
        result.push(item);
        if (item.children) flatten(item.children);
      });
    };
    flatten(locs);
    return result;
  };

  const getCellData = (documentType: string, locationId: string): MatrixCell | undefined => {
    if (!matrixData) return undefined;
    return matrixData.cells.find((c) => c.documentType === documentType && c.locationId === locationId);
  };

  const handleCellClick = (cell: MatrixCell | undefined, documentType: string, locationId: string) => {
    if (cell?.documentId) {
      navigate(`/projects/${projectId}/documents?doc=${cell.documentId}`);
    } else {
      navigate(`/projects/${projectId}/documents?create=true&type=${encodeURIComponent(documentType)}&location=${locationId}`);
    }
  };

  const buildColumns = (): ColumnsType<MatrixRow> => {
    if (!matrixData) return [];
    const flatLocs = flattenLocations(matrixData.locations);
    if (flatLocs.length === 0) return [
      { title: t.matrix?.documentType || 'Doküman Türü', dataIndex: 'documentType', key: 'documentType', width: 250, render: (text: string) => <strong>{text}</strong> },
    ];
    const columns: ColumnsType<MatrixRow> = [
      { title: t.matrix?.documentType || 'Doküman Türü', dataIndex: 'documentType', key: 'documentType', fixed: 'left', width: 250, render: (text: string) => <strong>{text}</strong> },
    ];
    flatLocs.forEach((loc) => {
      columns.push({
        title: <Tooltip title={loc.code || loc.name}><span style={{ fontSize: 12 }}>{loc.name}</span></Tooltip>,
        key: loc.id, width: 120, align: 'center',
        render: (_: unknown, record: MatrixRow) => {
          const cell = getCellData(record.documentType, loc.id);
          const status = cell?.status || 'MISSING';
          const config = statusConfig[status] || statusConfig.MISSING;
          return (
            <Tooltip title={<><div>{config.label}</div>{cell?.documentNumber && <div>No: {cell.documentNumber}</div>}</>}>
              <div style={{ cursor: 'pointer' }} onClick={() => handleCellClick(cell, record.documentType, loc.id)}>
                <Badge status={config.badgeStatus} text={cell?.documentId ? <EyeOutlined style={{ color: config.color }} /> : <FileAddOutlined style={{ color: config.color }} />} />
              </div>
            </Tooltip>
          );
        },
      });
    });
    return columns;
  };

  const buildDataSource = (): MatrixRow[] => {
    if (!matrixData) return [];
    return matrixData.documentTypes.map((dt) => ({ key: dt, documentType: dt }));
  };

  const workTypes = matrixData ? [...new Set(matrixData.rules.map((r) => r.workType).filter(Boolean))] : [];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col><Title level={3} style={{ margin: 0 }}>{t.matrix?.title || 'Evrak Matrisi'}</Title></Col>
        <Col>
          <Space>
            <Select value={filterWorkType} onChange={setFilterWorkType} allowClear placeholder={t.matrix?.workType || 'İş Türü'} style={{ width: 200 }} options={workTypes.map((wt) => ({ value: wt, label: wt }))} />
            <Select value={filterStatus} onChange={setFilterStatus} allowClear placeholder={t.app.status} style={{ width: 160 }} options={Object.entries(statusConfig).map(([value, cfg]) => ({ value, label: cfg.label }))} />
            <Button icon={<ReloadOutlined />} onClick={fetchMatrix}>{t.app.reset || 'Yenile'}</Button>
          </Space>
        </Col>
      </Row>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>{Object.entries(statusConfig).map(([key, cfg]) => <Tag key={key} color={cfg.color}>{cfg.label}</Tag>)}</Space>
      </Card>
      <Spin spinning={loading}>
        {matrixData && matrixData.documentTypes.length === 0 ? (
          <Empty description={t.matrix?.noRules || 'Bu proje için matris kuralı tanımlanmamış'} />
        ) : (
          <Table columns={buildColumns()} dataSource={buildDataSource()} pagination={false} scroll={{ x: 'max-content' }} bordered size="small" />
        )}
      </Spin>
    </div>
  );
};

export default DocumentMatrix;

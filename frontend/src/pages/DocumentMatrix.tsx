import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Tag,
  Select,
  Space,
  Typography,
  Spin,
  Card,
  Tooltip,
  Badge,
  Row,
  Col,
  Button,
  message,
} from 'antd';
import {
  FileAddOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import apiClient from '../api/client';
import type { MatrixData, MatrixCell, Location, DocumentStatus } from '../types';

const { Title } = Typography;

interface MatrixRow {
  key: string;
  documentType: string;
  [locationId: string]: string | MatrixCell | undefined;
}

const STATUS_CONFIG: Record<string, { color: string; label: string; badgeStatus: 'success' | 'processing' | 'warning' | 'error' | 'default' }> = {
  MISSING: { color: '#ff4d4f', label: 'Отсутствует', badgeStatus: 'error' },
  DRAFT: { color: '#faad14', label: 'Черновик', badgeStatus: 'warning' },
  IN_REVIEW: { color: '#1677ff', label: 'На проверке', badgeStatus: 'processing' },
  PENDING_SIGNATURE: { color: '#722ed1', label: 'На подписи', badgeStatus: 'processing' },
  SIGNED: { color: '#52c41a', label: 'Подписан', badgeStatus: 'success' },
  REJECTED: { color: '#ff4d4f', label: 'Отклонён', badgeStatus: 'error' },
  ARCHIVED: { color: '#8c8c8c', label: 'Архив', badgeStatus: 'default' },
};

const DocumentMatrix: React.FC = () => {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const [matrixData, setMatrixData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterWorkType, setFilterWorkType] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();

  const fetchMatrix = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterWorkType) params.workType = filterWorkType;
      if (filterStatus) params.status = filterStatus;
      const response = await apiClient.get(`/projects/${projectId}/matrix`, { params });
      setMatrixData(response.data);
    } catch {
      message.error('Ошибка загрузки матрицы документов');
    } finally {
      setLoading(false);
    }
  }, [projectId, filterWorkType, filterStatus]);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

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
    return matrixData.cells.find(
      (c) => c.documentType === documentType && c.locationId === locationId,
    );
  };

  const handleCellClick = (cell: MatrixCell | undefined, documentType: string, locationId: string) => {
    if (cell?.documentId) {
      navigate(`/projects/${projectId}/documents?doc=${cell.documentId}`);
    } else {
      navigate(
        `/projects/${projectId}/documents?create=true&type=${encodeURIComponent(documentType)}&location=${locationId}`,
      );
    }
  };

  const buildColumns = (): ColumnsType<MatrixRow> => {
    if (!matrixData) return [];

    const flatLocs = flattenLocations(matrixData.locations);

    const columns: ColumnsType<MatrixRow> = [
      {
        title: 'Тип документа',
        dataIndex: 'documentType',
        key: 'documentType',
        fixed: 'left',
        width: 250,
        render: (text: string) => <strong>{text}</strong>,
      },
    ];

    flatLocs.forEach((loc) => {
      columns.push({
        title: (
          <Tooltip title={loc.code || loc.name}>
            <span style={{ fontSize: 12 }}>{loc.name}</span>
          </Tooltip>
        ),
        key: loc.id,
        width: 120,
        align: 'center',
        render: (_: unknown, record: MatrixRow) => {
          const cell = getCellData(record.documentType, loc.id);
          const status = cell?.status || 'MISSING';
          const config = STATUS_CONFIG[status] || STATUS_CONFIG.MISSING;

          return (
            <Tooltip
              title={
                <>
                  <div>{config.label}</div>
                  {cell?.documentNumber && <div>№ {cell.documentNumber}</div>}
                </>
              }
            >
              <div
                style={{ cursor: 'pointer' }}
                onClick={() => handleCellClick(cell, record.documentType, loc.id)}
              >
                <Badge
                  status={config.badgeStatus}
                  text={
                    cell?.documentId ? (
                      <EyeOutlined style={{ color: config.color }} />
                    ) : (
                      <FileAddOutlined style={{ color: config.color }} />
                    )
                  }
                />
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
    return matrixData.documentTypes.map((dt) => ({
      key: dt,
      documentType: dt,
    }));
  };

  const workTypes = matrixData
    ? [...new Set(matrixData.rules.map((r) => r.workType).filter(Boolean))]
    : [];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            Матрица документов
          </Title>
        </Col>
        <Col>
          <Space>
            <Select
              value={filterWorkType}
              onChange={setFilterWorkType}
              allowClear
              placeholder="Вид работ"
              style={{ width: 200 }}
              options={workTypes.map((t) => ({ value: t, label: t }))}
            />
            <Select
              value={filterStatus}
              onChange={setFilterStatus}
              allowClear
              placeholder="Статус"
              style={{ width: 160 }}
              options={Object.entries(STATUS_CONFIG).map(([value, cfg]) => ({
                value,
                label: cfg.label,
              }))}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchMatrix}>
              Обновить
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Legend */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <Tag key={key} color={cfg.color}>
              {cfg.label}
            </Tag>
          ))}
        </Space>
      </Card>

      <Spin spinning={loading}>
        <Table
          columns={buildColumns()}
          dataSource={buildDataSource()}
          pagination={false}
          scroll={{ x: 'max-content' }}
          bordered
          size="small"
        />
      </Spin>
    </div>
  );
};

export default DocumentMatrix;

import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, DatePicker, Tag, Space,
  Badge, message, Popconfirm, Typography, Row, Col, Statistic, Timeline, List,
} from 'antd';
import {
  PlusOutlined, BugOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, WarningOutlined, SendOutlined,
  DeleteOutlined, EyeOutlined,
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import apiClient from '../api/client';
import { useI18n } from '../i18n';

const { TextArea } = Input;
const { Text } = Typography;

const Corrections: React.FC = () => {
  const { id: projectId } = useParams();
  const { t } = useI18n();
  const [corrections, setCorrections] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [members, setMembers] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedCorrection, setSelectedCorrection] = useState<any>(null);
  const [commentText, setCommentText] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [form] = Form.useForm();
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (projectId) {
      fetchCorrections();
      fetchStats();
      fetchMembers();
      fetchDocuments();
    }
  }, [projectId, filterStatus, page]);

  const fetchCorrections = async () => {
    setLoading(true);
    try {
      const params: any = { projectId, page, pageSize: 20 };
      if (filterStatus) params.status = filterStatus;
      const res = await apiClient.get('/corrections', { params });
      setCorrections(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const fetchStats = async () => {
    try {
      const res = await apiClient.get('/corrections/stats', { params: { projectId } });
      setStats(res.data);
    } catch { /* ignore */ }
  };

  const fetchMembers = async () => {
    try {
      const res = await apiClient.get('/team', { params: { projectId } });
      setMembers(res.data || []);
    } catch { /* ignore */ }
  };

  const fetchDocuments = async () => {
    try {
      const res = await apiClient.get('/documents', { params: { projectId, pageSize: 200 } });
      setDocuments(res.data.data || res.data || []);
    } catch { /* ignore */ }
  };

  const fetchDetail = async (id: string) => {
    try {
      const res = await apiClient.get(`/corrections/${id}`);
      setSelectedCorrection(res.data);
      setDetailVisible(true);
    } catch { /* ignore */ }
  };

  const handleCreate = async (values: any) => {
    try {
      await apiClient.post('/corrections', {
        projectId,
        documentId: values.documentId,
        errorType: values.errorType,
        description: values.description,
        severity: values.severity,
        assignedToId: values.assignedToId,
        dueDate: values.dueDate?.toISOString(),
      });
      message.success(t.app.success);
      setModalVisible(false);
      form.resetFields();
      fetchCorrections();
      fetchStats();
    } catch {
      message.error(t.app.error);
    }
  };

  const handleStatusChange = async (id: string, status: string, resolution?: string) => {
    try {
      await apiClient.put(`/corrections/${id}`, { status, resolution });
      message.success(t.app.success);
      fetchCorrections();
      fetchStats();
      if (selectedCorrection?.id === id) fetchDetail(id);
    } catch {
      message.error(t.app.error);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedCorrection) return;
    try {
      await apiClient.post(`/corrections/${selectedCorrection.id}/comments`, { text: commentText });
      setCommentText('');
      fetchDetail(selectedCorrection.id);
    } catch {
      message.error(t.app.error);
    }
  };

  const errorTypeLabels: Record<string, string> = {
    DATA_ERROR: t.corrections?.errorTypes?.DATA_ERROR || 'Data Error',
    FORMAT_ERROR: t.corrections?.errorTypes?.FORMAT_ERROR || 'Format Error',
    MISSING_INFO: t.corrections?.errorTypes?.MISSING_INFO || 'Missing Info',
    WRONG_REFERENCE: t.corrections?.errorTypes?.WRONG_REFERENCE || 'Wrong Reference',
    SIGNATURE_ERROR: t.corrections?.errorTypes?.SIGNATURE_ERROR || 'Signature Error',
    DATE_ERROR: t.corrections?.errorTypes?.DATE_ERROR || 'Date Error',
    CALCULATION_ERROR: t.corrections?.errorTypes?.CALCULATION_ERROR || 'Calculation Error',
    OTHER: t.corrections?.errorTypes?.OTHER || 'Other',
  };

  const severityColors: Record<string, string> = { LOW: 'default', MEDIUM: 'blue', HIGH: 'orange', CRITICAL: 'red' };
  const severityLabels: Record<string, string> = {
    LOW: t.corrections?.severities?.LOW || 'Low',
    MEDIUM: t.corrections?.severities?.MEDIUM || 'Medium',
    HIGH: t.corrections?.severities?.HIGH || 'High',
    CRITICAL: t.corrections?.severities?.CRITICAL || 'Critical',
  };

  const statusColors: Record<string, string> = {
    OPEN: 'error', IN_PROGRESS: 'processing', RESOLVED: 'success',
    VERIFIED: 'success', CLOSED: 'default', REOPENED: 'warning',
  };
  const statusLabels: Record<string, string> = {
    OPEN: t.corrections?.statuses?.OPEN || 'Open',
    IN_PROGRESS: t.corrections?.statuses?.IN_PROGRESS || 'In Progress',
    RESOLVED: t.corrections?.statuses?.RESOLVED || 'Resolved',
    VERIFIED: t.corrections?.statuses?.VERIFIED || 'Verified',
    CLOSED: t.corrections?.statuses?.CLOSED || 'Closed',
    REOPENED: t.corrections?.statuses?.REOPENED || 'Reopened',
  };

  const columns = [
    {
      title: t.corrections?.document || 'Document',
      key: 'document',
      render: (_: any, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.document?.title}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.document?.documentNumber}</Text>
        </Space>
      ),
    },
    {
      title: t.corrections?.errorType || 'Error Type',
      dataIndex: 'errorType',
      key: 'errorType',
      width: 150,
      render: (type: string) => <Tag>{errorTypeLabels[type]}</Tag>,
    },
    {
      title: t.corrections?.severity || 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity: string) => <Tag color={severityColors[severity]}>{severityLabels[severity]}</Tag>,
    },
    {
      title: t.app.status,
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => <Badge status={statusColors[status] as any} text={statusLabels[status]} />,
    },
    {
      title: t.corrections?.assignedTo || 'Assigned To',
      key: 'assignedTo',
      width: 150,
      render: (_: any, record: any) => record.assignedTo?.fio || '-',
    },
    {
      title: t.app.date,
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 110,
      render: (date: string) => dayjs(date).format('DD.MM.YYYY'),
    },
    {
      title: t.app.actions,
      key: 'actions',
      width: 140,
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => fetchDetail(record.id)} />
          {record.status === 'OPEN' && (
            <Button size="small" type="primary" onClick={() => handleStatusChange(record.id, 'IN_PROGRESS')}>
              {t.corrections?.startFix || 'Fix'}
            </Button>
          )}
          {record.status === 'IN_PROGRESS' && (
            <Button size="small" type="primary" onClick={() => handleStatusChange(record.id, 'RESOLVED')}>
              {t.corrections?.resolve || 'Resolve'}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}>
          <Card><Statistic title={t.corrections?.total || 'Total Errors'} value={stats.total || 0} prefix={<BugOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card><Statistic title={t.corrections?.statuses?.OPEN || 'Open'} value={stats.open || 0} prefix={<ExclamationCircleOutlined />} valueStyle={{ color: '#ff4d4f' }} /></Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card><Statistic title={t.corrections?.statuses?.IN_PROGRESS || 'In Progress'} value={stats.inProgress || 0} prefix={<WarningOutlined />} valueStyle={{ color: '#faad14' }} /></Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card><Statistic title={t.corrections?.statuses?.RESOLVED || 'Resolved'} value={stats.resolved || 0} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
      </Row>

      <Card
        title={t.corrections?.title || 'Document Corrections'}
        extra={
          <Space>
            <Select placeholder={t.app.filter} allowClear style={{ width: 160 }}
              onChange={(v) => { setFilterStatus(v); setPage(1); }}
              options={Object.entries(statusLabels).map(([k, v]) => ({ value: k, label: v }))}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
              {t.corrections?.reportError || 'Report Error'}
            </Button>
          </Space>
        }
      >
        <Table columns={columns} dataSource={corrections} rowKey="id" loading={loading}
          pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
        />
      </Card>

      {/* Create Correction Modal */}
      <Modal
        title={t.corrections?.reportError || 'Report Error'}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        onOk={() => form.submit()}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="documentId" label={t.corrections?.document || 'Document'} rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label"
              options={documents.map((d: any) => ({
                value: d.id,
                label: `${d.documentNumber || ''} ${d.title}`.trim(),
              }))}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="errorType" label={t.corrections?.errorType || 'Error Type'} rules={[{ required: true }]}>
                <Select options={Object.entries(errorTypeLabels).map(([k, v]) => ({ value: k, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="severity" label={t.corrections?.severity || 'Severity'} initialValue="MEDIUM">
                <Select options={Object.entries(severityLabels).map(([k, v]) => ({ value: k, label: v }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label={t.app.description} rules={[{ required: true }]}>
            <TextArea rows={4} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="assignedToId" label={t.corrections?.assignedTo || 'Assign To'}>
                <Select allowClear>
                  {members.map((m: any) => (
                    <Select.Option key={m.person?.id} value={m.person?.id}>{m.person?.fio}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="dueDate" label={t.tasks?.dueDate || 'Due Date'}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        title={t.corrections?.detail || 'Correction Detail'}
        open={detailVisible}
        onCancel={() => { setDetailVisible(false); setSelectedCorrection(null); }}
        width={700}
        footer={null}
      >
        {selectedCorrection && (
          <div>
            <Row gutter={16}>
              <Col span={12}>
                <p><strong>{t.corrections?.document || 'Document'}:</strong> {selectedCorrection.document?.title}</p>
                <p><strong>{t.corrections?.errorType || 'Error Type'}:</strong> <Tag>{errorTypeLabels[selectedCorrection.errorType]}</Tag></p>
                <p><strong>{t.corrections?.severity || 'Severity'}:</strong> <Tag color={severityColors[selectedCorrection.severity]}>{severityLabels[selectedCorrection.severity]}</Tag></p>
              </Col>
              <Col span={12}>
                <p><strong>{t.app.status}:</strong> <Badge status={statusColors[selectedCorrection.status] as any} text={statusLabels[selectedCorrection.status]} /></p>
                <p><strong>{t.corrections?.reportedBy || 'Reported By'}:</strong> {selectedCorrection.reportedBy?.fio}</p>
                <p><strong>{t.corrections?.assignedTo || 'Assigned To'}:</strong> {selectedCorrection.assignedTo?.fio || '-'}</p>
              </Col>
            </Row>
            <p><strong>{t.app.description}:</strong> {selectedCorrection.description}</p>
            {selectedCorrection.resolution && (
              <p><strong>{t.corrections?.resolution || 'Resolution'}:</strong> {selectedCorrection.resolution}</p>
            )}

            <Space style={{ marginBottom: 16 }}>
              {selectedCorrection.status === 'OPEN' && (
                <Button onClick={() => handleStatusChange(selectedCorrection.id, 'IN_PROGRESS')}>
                  {t.corrections?.startFix || 'Start Fix'}
                </Button>
              )}
              {selectedCorrection.status === 'IN_PROGRESS' && (
                <Button type="primary" onClick={() => {
                  const resolution = prompt(t.corrections?.enterResolution || 'Enter resolution:');
                  if (resolution) handleStatusChange(selectedCorrection.id, 'RESOLVED', resolution);
                }}>
                  {t.corrections?.resolve || 'Resolve'}
                </Button>
              )}
              {selectedCorrection.status === 'RESOLVED' && (
                <>
                  <Button type="primary" onClick={() => handleStatusChange(selectedCorrection.id, 'VERIFIED')}>
                    {t.corrections?.verify || 'Verify'}
                  </Button>
                  <Button danger onClick={() => handleStatusChange(selectedCorrection.id, 'REOPENED')}>
                    {t.corrections?.reopen || 'Reopen'}
                  </Button>
                </>
              )}
            </Space>

            <Card title={t.corrections?.comments || 'Comments'} size="small">
              <List
                dataSource={selectedCorrection.comments || []}
                renderItem={(comment: any) => (
                  <List.Item>
                    <List.Item.Meta
                      title={<Text strong>{comment.author?.fio} <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(comment.createdAt).format('DD.MM.YYYY HH:mm')}</Text></Text>}
                      description={comment.text}
                    />
                  </List.Item>
                )}
              />
              <Space.Compact style={{ width: '100%', marginTop: 8 }}>
                <Input value={commentText} onChange={(e) => setCommentText(e.target.value)}
                  placeholder={t.corrections?.addComment || 'Add comment...'} onPressEnter={handleAddComment} />
                <Button type="primary" icon={<SendOutlined />} onClick={handleAddComment} />
              </Space.Compact>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Corrections;

import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Space, Tag, Typography, Modal, Form, Input, Select,
  DatePicker, message, Drawer, Descriptions, Steps, List, Row, Col, Spin,
  Checkbox, Card, Divider, Empty, Statistic,
} from 'antd';
import {
  PlusOutlined, DownloadOutlined, EyeOutlined, FileTextOutlined,
  CheckCircleOutlined, FileZipOutlined, OrderedListOutlined,
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import apiClient, { getApiError } from '../api/client';
import type { Package, PackageStatus, Document } from '../types';
import { useI18n } from '../i18n';

const { Title, Text } = Typography;

const Packages: React.FC = () => {
  const { id: projectId } = useParams();
  const { t } = useI18n();

  const packageStatusLabels: Record<string, { color: string; label: string }> = {
    DRAFT: { color: 'default', label: t.package?.statuses?.DRAFT || 'Taslak' },
    GENERATING: { color: 'blue', label: t.package?.statuses?.GENERATING || 'Oluşturuluyor' },
    READY: { color: 'green', label: t.package?.statuses?.READY || 'Hazır' },
    DELIVERED: { color: 'purple', label: t.package?.statuses?.DELIVERED || 'Teslim Edildi' },
  };

  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(false);
  const [wizardVisible, setWizardVisible] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardForm] = Form.useForm();
  const [wizardLoading, setWizardLoading] = useState(false);
  const [availableDocs, setAvailableDocs] = useState<Document[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchPackages = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const response = await apiClient.get('/packages', { params: { projectId } });
      const data = response.data;
      setPackages(data.data || data || []);
    } catch (error) {
      message.error(getApiError(error, t.app.error));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchPackages(); }, [fetchPackages]);

  const fetchAvailableDocuments = async () => {
    if (!projectId) return;
    setDocsLoading(true);
    try {
      const values = wizardForm.getFieldsValue();
      const params: Record<string, string> = { projectId, status: 'SIGNED' };
      if (values.periodStart) params.dateFrom = values.periodStart.format('YYYY-MM-DD');
      if (values.periodEnd) params.dateTo = values.periodEnd.format('YYYY-MM-DD');
      const response = await apiClient.get('/documents', { params });
      const data = response.data;
      const docs = data.data || data || [];
      setAvailableDocs(docs);
      setSelectedDocIds(docs.map((d: Document) => d.id));
    } catch (error) {
      message.error(getApiError(error, t.app.error));
    } finally {
      setDocsLoading(false);
    }
  };

  const openPackageDetail = async (id: string) => {
    setDetailLoading(true);
    setDetailDrawerVisible(true);
    try {
      const response = await apiClient.get(`/packages/${id}`);
      setSelectedPackage(response.data);
    } catch (error) {
      message.error(getApiError(error, t.app.error));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreatePackage = async () => {
    try {
      const values = await wizardForm.validateFields();
      setWizardLoading(true);
      const pkgRes = await apiClient.post('/packages', {
        projectId, name: values.name,
        description: values.description,
        periodFrom: values.periodStart?.format('YYYY-MM-DD'),
        periodTo: values.periodEnd?.format('YYYY-MM-DD'),
      });
      // Add selected documents as package items
      if (selectedDocIds.length > 0) {
        const pkgId = pkgRes.data.id;
        await apiClient.post(`/packages/${pkgId}/items/bulk`, {
          items: selectedDocIds.map((docId, idx) => ({
            documentId: docId,
            folderPath: '/',
            sortOrder: idx,
          })),
        });
      }
      message.success(t.app.success);
      setWizardVisible(false);
      wizardForm.resetFields();
      setWizardStep(0);
      setSelectedDocIds([]);
      setAvailableDocs([]);
      fetchPackages();
    } catch (error: unknown) {
      const msg = getApiError(error, t.app.error);
      if (msg) message.error(msg);
    } finally {
      setWizardLoading(false);
    }
  };

  const handleDownloadZip = async (packageId: string) => {
    try {
      const response = await apiClient.get(`/packages/${packageId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url; link.setAttribute('download', `package-${packageId}.zip`);
      document.body.appendChild(link); link.click(); link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) { message.error(getApiError(error, t.app.error)); }
  };

  const handleDownloadInventory = async (packageId: string) => {
    try {
      const response = await apiClient.get(`/packages/${packageId}/inventory`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url; link.setAttribute('download', `inventory-${packageId}.pdf`);
      document.body.appendChild(link); link.click(); link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) { message.error(getApiError(error, t.app.error)); }
  };

  const columns = [
    { title: t.app.name, dataIndex: 'name', key: 'name', ellipsis: true },
    { title: t.package?.period || 'Dönem', key: 'period', width: 200, render: (_: unknown, record: any) => {
      if (record.periodFrom && record.periodTo) return `${dayjs(record.periodFrom).format('DD.MM.YYYY')} — ${dayjs(record.periodTo).format('DD.MM.YYYY')}`;
      if (record.periodFrom) return dayjs(record.periodFrom).format('DD.MM.YYYY');
      return t.app.noData;
    }},
    { title: t.doc?.title || 'Doküman', key: 'docCount', width: 110, render: (_: unknown, record: any) => record._count?.items || 0 },
    { title: t.app.status, dataIndex: 'status', key: 'status', width: 120, render: (status: PackageStatus) => { const cfg = packageStatusLabels[status] || { color: 'default', label: status }; return <Tag color={cfg.color}>{cfg.label}</Tag>; } },
    { title: t.app.actions, key: 'actions', width: 150, render: (_: unknown, record: Package) => (
      <Space>
        <Button type="link" icon={<EyeOutlined />} onClick={() => openPackageDetail(record.id)} />
        <Button type="link" icon={<FileZipOutlined />} onClick={() => handleDownloadZip(record.id)} title={t.package?.download} />
        <Button type="link" icon={<OrderedListOutlined />} onClick={() => handleDownloadInventory(record.id)} title={t.package?.inventory} />
      </Space>
    )},
  ];

  const wizardSteps = [
    { title: t.app.description, description: t.package?.name },
    { title: t.doc?.title, description: t.package?.includedDocs },
    { title: t.app.confirm, description: t.package?.create },
  ];

  const handleWizardNext = async () => {
    if (wizardStep === 0) {
      try { await wizardForm.validateFields(); } catch { return; }
      await fetchAvailableDocuments();
    }
    setWizardStep(wizardStep + 1);
  };

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col><Title level={3} style={{ margin: 0 }}>{t.package?.title}</Title></Col>
        <Col><Button type="primary" icon={<PlusOutlined />} onClick={() => setWizardVisible(true)}>{t.package?.create}</Button></Col>
      </Row>
      <Table columns={columns} dataSource={packages} rowKey="id" loading={loading} pagination={false} />

      <Modal title={t.package?.create} open={wizardVisible}
        onCancel={() => { setWizardVisible(false); wizardForm.resetFields(); setWizardStep(0); setSelectedDocIds([]); setAvailableDocs([]); }}
        width={800}
        footer={
          <Space>
            {wizardStep > 0 && <Button onClick={() => setWizardStep(wizardStep - 1)}>{t.app.back}</Button>}
            <Button onClick={() => { setWizardVisible(false); wizardForm.resetFields(); setWizardStep(0); }}>{t.app.cancel}</Button>
            {wizardStep < wizardSteps.length - 1 ? (
              <Button type="primary" onClick={handleWizardNext}>{t.app.next}</Button>
            ) : (
              <Button type="primary" loading={wizardLoading} onClick={handleCreatePackage} icon={<CheckCircleOutlined />}>{t.package?.create}</Button>
            )}
          </Space>
        }>
        <Steps current={wizardStep} items={wizardSteps} size="small" style={{ marginBottom: 24 }} />
        {wizardStep === 0 && (
          <Form form={wizardForm} layout="vertical" style={{ maxWidth: 500 }}>
            <Form.Item name="name" label={t.package?.name} rules={[{ required: true, message: t.app.required }]}><Input /></Form.Item>
            <Row gutter={16}>
              <Col span={12}><Form.Item name="periodStart" label={t.package?.periodFrom}><DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" /></Form.Item></Col>
              <Col span={12}><Form.Item name="periodEnd" label={t.package?.periodTo}><DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" /></Form.Item></Col>
            </Row>
            <Form.Item name="description" label={t.app.description}><Input.TextArea rows={2} /></Form.Item>
          </Form>
        )}
        {wizardStep === 1 && (
          <Spin spinning={docsLoading}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Card size="small"><Statistic title={t.package?.includedDocs} value={selectedDocIds.length} suffix={`/ ${availableDocs.length}`} /></Card>
              <Checkbox.Group value={selectedDocIds} onChange={(vals) => setSelectedDocIds(vals as string[])} style={{ width: '100%' }}>
                <List dataSource={availableDocs} locale={{ emptyText: t.app.noData }}
                  renderItem={(doc: Document) => (
                    <List.Item><Checkbox value={doc.id} style={{ width: '100%' }}>
                      <Space><FileTextOutlined /><Text strong>{doc.documentNumber || ''}</Text><Text>{doc.title}</Text><Tag color="green">{t.doc?.statuses?.SIGNED}</Tag><Text type="secondary">{dayjs(doc.createdAt).format('DD.MM.YYYY')}</Text></Space>
                    </Checkbox></List.Item>
                  )} />
              </Checkbox.Group>
            </Space>
          </Spin>
        )}
        {wizardStep === 2 && (
          <div>
            <Descriptions bordered column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label={t.app.name}>{wizardForm.getFieldValue('name') || '—'}</Descriptions.Item>
              <Descriptions.Item label={t.package?.period}>{wizardForm.getFieldValue('periodStart') ? `${dayjs(wizardForm.getFieldValue('periodStart')).format('DD.MM.YYYY')} — ${wizardForm.getFieldValue('periodEnd') ? dayjs(wizardForm.getFieldValue('periodEnd')).format('DD.MM.YYYY') : '...'}` : t.app.noData}</Descriptions.Item>
              <Descriptions.Item label={t.doc?.title}>{selectedDocIds.length}</Descriptions.Item>
            </Descriptions>
            {selectedDocIds.length > 0 && (
              <Card title={t.package?.includedDocs} size="small">
                <List dataSource={availableDocs.filter((d) => selectedDocIds.includes(d.id))} size="small"
                  renderItem={(doc: Document, index: number) => <List.Item><Text>{index + 1}. {doc.documentNumber || ''} — {doc.title}</Text></List.Item>} />
              </Card>
            )}
          </div>
        )}
      </Modal>

      <Drawer title={selectedPackage ? selectedPackage.name : t.package?.title} open={detailDrawerVisible}
        onClose={() => { setDetailDrawerVisible(false); setSelectedPackage(null); }} width={700}
        extra={selectedPackage && (
          <Space>
            <Button icon={<FileZipOutlined />} onClick={() => handleDownloadZip(selectedPackage.id)}>{t.package?.download}</Button>
            <Button icon={<OrderedListOutlined />} onClick={() => handleDownloadInventory(selectedPackage.id)}>{t.package?.inventory}</Button>
          </Space>
        )}>
        <Spin spinning={detailLoading}>
          {selectedPackage && (
            <>
              <Descriptions bordered column={2} size="small" style={{ marginBottom: 24 }}>
                <Descriptions.Item label={t.app.name} span={2}>{selectedPackage.name}</Descriptions.Item>
                <Descriptions.Item label={t.app.status}><Tag color={packageStatusLabels[selectedPackage.status]?.color}>{packageStatusLabels[selectedPackage.status]?.label}</Tag></Descriptions.Item>
                <Descriptions.Item label={t.package?.period}>{(selectedPackage as any).periodFrom ? `${dayjs((selectedPackage as any).periodFrom).format('DD.MM.YYYY')} — ${(selectedPackage as any).periodTo ? dayjs((selectedPackage as any).periodTo).format('DD.MM.YYYY') : '...'}` : t.app.noData}</Descriptions.Item>
                <Descriptions.Item label={t.doc?.title}>{(selectedPackage as any).items?.length || 0}</Descriptions.Item>
                {selectedPackage.description && <Descriptions.Item label={t.app.description} span={2}>{selectedPackage.description}</Descriptions.Item>}
              </Descriptions>
              <Divider orientation="left">{t.package?.includedDocs}</Divider>
              {(selectedPackage as any).items && (selectedPackage as any).items.length > 0 ? (
                <List dataSource={(selectedPackage as any).items}
                  renderItem={(item: any, index: number) => (
                    <List.Item>
                      <List.Item.Meta avatar={<FileTextOutlined style={{ fontSize: 20 }} />}
                        title={`${index + 1}. ${item.document?.documentNumber || ''} — ${item.document?.title || ''}`}
                        description={<Space><Tag>{item.document?.documentType}</Tag><Tag color="green">{t.doc?.statuses?.SIGNED}</Tag></Space>} />
                    </List.Item>
                  )} />
              ) : (
                <Empty description={t.app.noData} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </>
          )}
        </Spin>
      </Drawer>
    </div>
  );
};

export default Packages;

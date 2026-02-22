import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Space, Tag, Typography, Modal, Form, Input, Select,
  DatePicker, InputNumber, message, Drawer, Descriptions, Tabs, List,
  Row, Col, Spin, Card, Badge,
} from 'antd';
import {
  PlusOutlined, SafetyCertificateOutlined, ExperimentOutlined,
  EyeOutlined, DownloadOutlined,
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import apiClient from '../api/client';
import type {
  Material, MaterialStatus, MaterialCertificate, IncomingControl,
  CertificateType, InspectionResult, WorkItem,
} from '../types';
import FileUpload from '../components/FileUpload';
import { useI18n } from '../i18n';

const { Title, Text } = Typography;

const Materials: React.FC = () => {
  const { id: projectId } = useParams();
  const { t } = useI18n();

  const materialStatusLabels: Record<string, { color: string; label: string }> = {
    ORDERED: { color: 'default', label: t.material?.statuses?.ORDERED || 'Sipariş Edildi' },
    DELIVERED: { color: 'blue', label: t.material?.statuses?.DELIVERED || 'Teslim Edildi' },
    INSPECTED: { color: 'purple', label: t.material?.statuses?.INSPECTED || 'Kontrol Edildi' },
    ACCEPTED: { color: 'green', label: t.material?.controlResults?.ACCEPTED || 'Kabul' },
    REJECTED: { color: 'red', label: t.material?.controlResults?.REJECTED || 'Red' },
    IN_USE: { color: 'cyan', label: t.material?.statuses?.IN_USE || 'Kullanımda' },
    USED: { color: 'default', label: t.material?.statuses?.USED || 'Tüketildi' },
  };

  const certTypeLabels: Record<string, string> = {
    QUALITY_PASSPORT: t.material?.certTypes?.PASSPORT || 'Pasaport',
    CONFORMITY_CERT: t.material?.certTypes?.CONFORMITY_CERT || 'Uygunluk Sertifikası',
    TEST_REPORT: t.material?.certTypes?.TEST_REPORT || 'Test Raporu',
    FIRE_SAFETY_CERT: t.material?.certTypes?.FIRE_CERT || 'Yangın Sertifikası',
    SANITARY_CERT: t.material?.certTypes?.SANITARY_CERT || 'Sağlık Belgesi',
    MANUFACTURER_CERT: t.material?.certTypes?.QUALITY_CERT || 'Üretici Sertifikası',
  };

  const controlResultLabels: Record<string, { color: string; label: string }> = {
    ACCEPTED: { color: 'green', label: t.material?.controlResults?.ACCEPTED || 'Kabul' },
    CONDITIONALLY_ACCEPTED: { color: 'orange', label: t.material?.controlResults?.CONDITIONALLY_ACCEPTED || 'Koşullu Kabul' },
    REJECTED: { color: 'red', label: t.material?.controlResults?.REJECTED || 'Red' },
  };

  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [createLoading, setCreateLoading] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [certModalVisible, setCertModalVisible] = useState(false);
  const [certForm] = Form.useForm();
  const [certLoading, setCertLoading] = useState(false);
  const [controlModalVisible, setControlModalVisible] = useState(false);
  const [controlForm] = Form.useForm();
  const [controlLoading, setControlLoading] = useState(false);

  const fetchMaterials = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const response = await apiClient.get('/materials', {
        params: { projectId, page, limit: pageSize },
      });
      const data = response.data;
      setMaterials(data.data || data || []);
      setTotal(data.total || 0);
    } catch {
      message.error(t.app.error);
    } finally {
      setLoading(false);
    }
  }, [projectId, page, pageSize]);

  useEffect(() => { fetchMaterials(); }, [fetchMaterials]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetailDrawerVisible(true);
    try {
      const response = await apiClient.get(`/materials/${id}`);
      setSelectedMaterial(response.data);
    } catch {
      message.error(t.app.error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setCreateLoading(true);
      await apiClient.post('/materials', {
        projectId, name: values.name, brand: values.brand,
        manufacturer: values.manufacturer, batchNumber: values.batchNumber,
        supplier: values.supplier, quantity: values.quantity, unit: values.unit,
        arrivalDate: values.arrivalDate?.format('YYYY-MM-DD'),
      });
      message.success(t.app.success);
      setCreateModalVisible(false);
      createForm.resetFields();
      fetchMaterials();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) message.error(t.app.error);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleAddCertificate = async () => {
    if (!selectedMaterial) return;
    try {
      const values = await certForm.validateFields();
      setCertLoading(true);
      await apiClient.post(`/materials/${selectedMaterial.id}/certificates`, {
        ...values,
        issueDate: values.issueDate?.format('YYYY-MM-DD'),
        expiryDate: values.expiryDate?.format('YYYY-MM-DD'),
      });
      message.success(t.app.success);
      setCertModalVisible(false);
      certForm.resetFields();
      openDetail(selectedMaterial.id);
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) message.error(t.app.error);
    } finally {
      setCertLoading(false);
    }
  };

  const handleAddControl = async () => {
    if (!selectedMaterial) return;
    try {
      const values = await controlForm.validateFields();
      setControlLoading(true);
      await apiClient.post(`/materials/${selectedMaterial.id}/incoming-controls`, {
        ...values,
        inspectionDate: values.inspectionDate?.format('YYYY-MM-DD'),
      });
      message.success(t.app.success);
      setControlModalVisible(false);
      controlForm.resetFields();
      openDetail(selectedMaterial.id);
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) message.error(t.app.error);
    } finally {
      setControlLoading(false);
    }
  };

  const getCertStatus = (mat: Material) => {
    if (!mat.certificates || mat.certificates.length === 0) return <Badge status="error" text={t.material?.noCerts || 'Sertifika Yok'} />;
    return <Badge status="success" text={`${mat.certificates.length} sertifika`} />;
  };

  const getControlStatus = (mat: Material) => {
    if (!mat.incomingControls || mat.incomingControls.length === 0) return <Text type="secondary">{t.material?.noControl || 'Yapılmadı'}</Text>;
    const latest = mat.incomingControls[mat.incomingControls.length - 1];
    const cfg = controlResultLabels[latest.result] || { color: 'default', label: latest.result };
    return <Tag color={cfg.color}>{cfg.label}</Tag>;
  };

  const columns = [
    { title: t.material?.name, dataIndex: 'name', key: 'name', render: (text: string) => <Text strong>{text}</Text> },
    { title: t.material?.brand, dataIndex: 'brand', key: 'brand', width: 120 },
    { title: t.material?.batchNumber, dataIndex: 'batchNumber', key: 'batchNumber', width: 120 },
    { title: t.material?.supplier, dataIndex: 'supplier', key: 'supplier', width: 150 },
    { title: t.material?.arrivalDate, dataIndex: 'arrivalDate', key: 'arrivalDate', width: 120, render: (date: string) => (date ? dayjs(date).format('DD.MM.YYYY') : '—') },
    { title: t.material?.certificates, key: 'certs', width: 150, render: (_: unknown, record: Material) => getCertStatus(record) },
    { title: t.material?.incomingControl, key: 'control', width: 150, render: (_: unknown, record: Material) => getControlStatus(record) },
    { title: t.app.status, dataIndex: 'status', key: 'status', width: 120, render: (status: MaterialStatus) => { const cfg = materialStatusLabels[status] || { color: 'default', label: status }; return <Tag color={cfg.color}>{cfg.label}</Tag>; } },
    { title: '', key: 'actions', width: 60, render: (_: unknown, record: Material) => <Button type="link" icon={<EyeOutlined />} onClick={() => openDetail(record.id)} /> },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col><Title level={3} style={{ margin: 0 }}>{t.material?.title}</Title></Col>
        <Col><Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>{t.material?.addMaterial}</Button></Col>
      </Row>
      <Table columns={columns} dataSource={materials} rowKey="id" loading={loading} pagination={{ current: page, pageSize, total, showSizeChanger: true, showTotal: (totalCount) => `${totalCount} ${t.tasks?.items || 'kayıt'}`, onChange: (p, ps) => { setPage(p); setPageSize(ps); } }} />

      <Modal title={t.material?.addMaterial} open={createModalVisible} onOk={handleCreate} onCancel={() => { setCreateModalVisible(false); createForm.resetFields(); }} okText={t.app.create} cancelText={t.app.cancel} confirmLoading={createLoading} width={600}>
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label={t.material?.name} rules={[{ required: true, message: t.app.required }]}><Input /></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="brand" label={t.material?.brand}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="manufacturer" label={t.material?.manufacturer}><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="batchNumber" label={t.material?.batchNumber}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="supplier" label={t.material?.supplier}><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="arrivalDate" label={t.material?.arrivalDate}><DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" /></Form.Item></Col>
            <Col span={8}><Form.Item name="quantity" label={t.material?.quantity}><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
            <Col span={8}><Form.Item name="unit" label={t.material?.unit}><Input /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Drawer title={selectedMaterial?.name || t.material?.title} open={detailDrawerVisible} onClose={() => { setDetailDrawerVisible(false); setSelectedMaterial(null); }} width={750}>
        <Spin spinning={detailLoading}>
          {selectedMaterial && (
            <Tabs defaultActiveKey="info" items={[
              { key: 'info', label: t.app.description, children: (
                <Descriptions bordered column={2} size="small">
                  <Descriptions.Item label={t.material?.name} span={2}>{selectedMaterial.name}</Descriptions.Item>
                  <Descriptions.Item label={t.material?.brand}>{selectedMaterial.brand || '—'}</Descriptions.Item>
                  <Descriptions.Item label={t.material?.manufacturer}>{selectedMaterial.manufacturer || '—'}</Descriptions.Item>
                  <Descriptions.Item label={t.material?.batchNumber}>{selectedMaterial.batchNumber || '—'}</Descriptions.Item>
                  <Descriptions.Item label={t.material?.supplier}>{selectedMaterial.supplier || '—'}</Descriptions.Item>
                  <Descriptions.Item label={t.material?.arrivalDate}>{selectedMaterial.arrivalDate ? dayjs(selectedMaterial.arrivalDate).format('DD.MM.YYYY') : '—'}</Descriptions.Item>
                  <Descriptions.Item label={t.material?.quantity}>{selectedMaterial.quantity ? `${selectedMaterial.quantity} ${selectedMaterial.unit || ''}` : '—'}</Descriptions.Item>
                  <Descriptions.Item label={t.app.status} span={2}><Tag color={materialStatusLabels[selectedMaterial.status]?.color}>{materialStatusLabels[selectedMaterial.status]?.label}</Tag></Descriptions.Item>
                </Descriptions>
              )},
              { key: 'certificates', label: <Space><SafetyCertificateOutlined />{t.material?.certificates} ({selectedMaterial.certificates?.length || 0})</Space>, children: (
                <div>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setCertModalVisible(true)} style={{ marginBottom: 16 }}>{t.material?.addCertificate}</Button>
                  <List dataSource={selectedMaterial.certificates || []} locale={{ emptyText: t.app.noData }}
                    renderItem={(cert: MaterialCertificate) => (
                      <List.Item actions={[cert.fileUrl && <Button key="dl" type="link" icon={<DownloadOutlined />} href={cert.fileUrl} target="_blank">{t.app.download}</Button>].filter(Boolean)}>
                        <List.Item.Meta avatar={<SafetyCertificateOutlined style={{ fontSize: 24 }} />} title={certTypeLabels[cert.type] || cert.type}
                          description={<Space direction="vertical" size={0}>{cert.number && <Text>No: {cert.number}</Text>}{cert.issuer && <Text type="secondary">{cert.issuer}</Text>}{cert.issueDate && <Text type="secondary">{dayjs(cert.issueDate).format('DD.MM.YYYY')}{cert.expiryDate && ` — ${dayjs(cert.expiryDate).format('DD.MM.YYYY')}`}</Text>}</Space>} />
                      </List.Item>
                    )} />
                </div>
              )},
              { key: 'control', label: <Space><ExperimentOutlined />{t.material?.incomingControl} ({selectedMaterial.incomingControls?.length || 0})</Space>, children: (
                <div>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setControlModalVisible(true)} style={{ marginBottom: 16 }}>{t.material?.performControl}</Button>
                  <List dataSource={selectedMaterial.incomingControls || []} locale={{ emptyText: t.app.noData }}
                    renderItem={(ctrl: IncomingControl) => {
                      const resCfg = controlResultLabels[ctrl.result] || { color: 'default', label: ctrl.result };
                      return (
                        <Card size="small" style={{ marginBottom: 8 }}>
                          <Descriptions size="small" column={2}>
                            <Descriptions.Item label={t.app.date}>{dayjs(ctrl.inspectionDate).format('DD.MM.YYYY')}</Descriptions.Item>
                            <Descriptions.Item label={t.app.status}><Tag color={resCfg.color}>{resCfg.label}</Tag></Descriptions.Item>
                            {ctrl.visualCheck && <Descriptions.Item span={2}>{ctrl.visualCheck}</Descriptions.Item>}
                            {ctrl.notes && <Descriptions.Item label={t.journal?.notes} span={2}>{ctrl.notes}</Descriptions.Item>}
                          </Descriptions>
                        </Card>
                      );
                    }} />
                </div>
              )},
            ]} />
          )}
        </Spin>
      </Drawer>

      <Modal title={t.material?.addCertificate} open={certModalVisible} onOk={handleAddCertificate} onCancel={() => { setCertModalVisible(false); certForm.resetFields(); }} okText={t.app.create} cancelText={t.app.cancel} confirmLoading={certLoading} width={600}>
        <Form form={certForm} layout="vertical">
          <Form.Item name="type" label={t.app.type} rules={[{ required: true, message: t.app.required }]}>
            <Select options={Object.entries(certTypeLabels).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="number" label="No"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="issuer" label={t.material?.issuer || 'Veren Kurum'}><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="issueDate" label={t.app.date}><DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" /></Form.Item></Col>
            <Col span={12}><Form.Item name="expiryDate" label={t.material?.expiryDate || 'Geçerlilik'}><DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal title={t.material?.performControl} open={controlModalVisible} onOk={handleAddControl} onCancel={() => { setControlModalVisible(false); controlForm.resetFields(); }} okText={t.app.save} cancelText={t.app.cancel} confirmLoading={controlLoading} width={600}>
        <Form form={controlForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}><Form.Item name="inspectionDate" label={t.app.date} rules={[{ required: true }]} initialValue={dayjs()}><DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" /></Form.Item></Col>
            <Col span={12}><Form.Item name="result" label={t.app.status} rules={[{ required: true }]}><Select options={Object.entries(controlResultLabels).map(([value, cfg]) => ({ value, label: cfg.label }))} /></Form.Item></Col>
          </Row>
          <Form.Item name="visualCheck" label={t.material?.visualCheck || 'Görsel Kontrol'}><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="measurements" label={t.material?.measurements || 'Ölçümler'}><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="notes" label={t.journal?.notes || 'Notlar'}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Materials;

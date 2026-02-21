import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  message,
  Drawer,
  Descriptions,
  Tabs,
  List,
  Row,
  Col,
  Spin,
  Divider,
  Upload,
  Card,
  Badge,
} from 'antd';
import {
  PlusOutlined,
  UploadOutlined,
  SafetyCertificateOutlined,
  ExperimentOutlined,
  EyeOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import apiClient from '../api/client';
import type {
  Material,
  MaterialStatus,
  MaterialCertificate,
  IncomingControl,
  CertificateType,
  InspectionResult,
  WorkItem,
  Attachment,
} from '../types';
import FileUpload from '../components/FileUpload';

const { Title, Text } = Typography;

const MATERIAL_STATUS_CONFIG: Record<MaterialStatus, { color: string; label: string }> = {
  ORDERED: { color: 'default', label: 'Заказан' },
  DELIVERED: { color: 'blue', label: 'Доставлен' },
  INSPECTED: { color: 'purple', label: 'Проверен' },
  ACCEPTED: { color: 'green', label: 'Принят' },
  REJECTED: { color: 'red', label: 'Отклонён' },
  IN_USE: { color: 'cyan', label: 'Используется' },
  USED: { color: 'default', label: 'Израсходован' },
};

const CERT_TYPE_LABELS: Record<CertificateType, string> = {
  QUALITY_PASSPORT: 'Паспорт качества',
  CONFORMITY_CERT: 'Сертификат соответствия',
  TEST_REPORT: 'Протокол испытаний',
  FIRE_SAFETY_CERT: 'Сертификат пожарной безопасности',
  SANITARY_CERT: 'Санитарный сертификат',
  MANUFACTURER_CERT: 'Сертификат производителя',
};

const INSPECTION_RESULT_CONFIG: Record<InspectionResult, { color: string; label: string }> = {
  ACCEPTED: { color: 'green', label: 'Принят' },
  CONDITIONALLY_ACCEPTED: { color: 'orange', label: 'Условно принят' },
  REJECTED: { color: 'red', label: 'Отклонён' },
};

const Materials: React.FC = () => {
  const { id: projectId } = useParams();

  const [materials, setMaterials] = useState<Material[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Create modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [createLoading, setCreateLoading] = useState(false);

  // Detail drawer
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Certificate modal
  const [certModalVisible, setCertModalVisible] = useState(false);
  const [certForm] = Form.useForm();
  const [certLoading, setCertLoading] = useState(false);

  // Incoming control modal
  const [controlModalVisible, setControlModalVisible] = useState(false);
  const [controlForm] = Form.useForm();
  const [controlLoading, setControlLoading] = useState(false);

  const fetchMaterials = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const response = await apiClient.get(`/projects/${projectId}/materials`, {
        params: { page, pageSize },
      });
      const data = response.data;
      setMaterials(data.data || data || []);
      setTotal(data.total || 0);
    } catch {
      message.error('Ошибка загрузки материалов');
    } finally {
      setLoading(false);
    }
  }, [projectId, page, pageSize]);

  const fetchWorkItems = useCallback(async () => {
    if (!projectId) return;
    try {
      const response = await apiClient.get(`/projects/${projectId}/work-items`);
      setWorkItems(response.data.data || response.data || []);
    } catch {
      // ignore
    }
  }, [projectId]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  useEffect(() => {
    fetchWorkItems();
  }, [fetchWorkItems]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetailDrawerVisible(true);
    try {
      const response = await apiClient.get(`/materials/${id}`);
      setSelectedMaterial(response.data);
    } catch {
      message.error('Ошибка загрузки материала');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setCreateLoading(true);
      const payload = {
        ...values,
        projectId,
        arrivalDate: values.arrivalDate?.format('YYYY-MM-DD'),
      };
      await apiClient.post(`/projects/${projectId}/materials`, payload);
      message.success('Материал добавлен');
      setCreateModalVisible(false);
      createForm.resetFields();
      fetchMaterials();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; errorFields?: unknown };
      if (!err.errorFields) {
        message.error(err.response?.data?.message || 'Ошибка добавления материала');
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const handleAddCertificate = async () => {
    if (!selectedMaterial) return;
    try {
      const values = await certForm.validateFields();
      setCertLoading(true);
      const payload = {
        ...values,
        issueDate: values.issueDate?.format('YYYY-MM-DD'),
        expiryDate: values.expiryDate?.format('YYYY-MM-DD'),
      };
      await apiClient.post(`/materials/${selectedMaterial.id}/certificates`, payload);
      message.success('Сертификат добавлен');
      setCertModalVisible(false);
      certForm.resetFields();
      openDetail(selectedMaterial.id);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; errorFields?: unknown };
      if (!err.errorFields) {
        message.error(err.response?.data?.message || 'Ошибка добавления сертификата');
      }
    } finally {
      setCertLoading(false);
    }
  };

  const handleAddControl = async () => {
    if (!selectedMaterial) return;
    try {
      const values = await controlForm.validateFields();
      setControlLoading(true);
      const payload = {
        ...values,
        inspectionDate: values.inspectionDate?.format('YYYY-MM-DD'),
      };
      await apiClient.post(`/materials/${selectedMaterial.id}/incoming-controls`, payload);
      message.success('Запись входного контроля добавлена');
      setControlModalVisible(false);
      controlForm.resetFields();
      openDetail(selectedMaterial.id);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; errorFields?: unknown };
      if (!err.errorFields) {
        message.error(err.response?.data?.message || 'Ошибка добавления записи контроля');
      }
    } finally {
      setControlLoading(false);
    }
  };

  const getCertStatus = (mat: Material) => {
    if (!mat.certificates || mat.certificates.length === 0) {
      return <Badge status="error" text="Нет сертификатов" />;
    }
    return <Badge status="success" text={`${mat.certificates.length} серт.`} />;
  };

  const getControlStatus = (mat: Material) => {
    if (!mat.incomingControls || mat.incomingControls.length === 0) {
      return <Text type="secondary">Не проводился</Text>;
    }
    const latest = mat.incomingControls[mat.incomingControls.length - 1];
    const cfg = INSPECTION_RESULT_CONFIG[latest.result];
    return <Tag color={cfg.color}>{cfg.label}</Tag>;
  };

  const columns = [
    {
      title: 'Наименование',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Марка',
      dataIndex: 'brand',
      key: 'brand',
      width: 120,
    },
    {
      title: 'Партия',
      dataIndex: 'batchNumber',
      key: 'batchNumber',
      width: 120,
    },
    {
      title: 'Поставщик',
      dataIndex: 'supplier',
      key: 'supplier',
      width: 150,
    },
    {
      title: 'Дата поставки',
      dataIndex: 'arrivalDate',
      key: 'arrivalDate',
      width: 120,
      render: (date: string) => (date ? dayjs(date).format('DD.MM.YYYY') : '—'),
    },
    {
      title: 'Сертификаты',
      key: 'certs',
      width: 150,
      render: (_: unknown, record: Material) => getCertStatus(record),
    },
    {
      title: 'Контроль',
      key: 'control',
      width: 150,
      render: (_: unknown, record: Material) => getControlStatus(record),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: MaterialStatus) => {
        const cfg = MATERIAL_STATUS_CONFIG[status];
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_: unknown, record: Material) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => openDetail(record.id)}
        />
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            Материалы
          </Title>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            Добавить материал
          </Button>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={materials}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `Всего: ${t}`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      {/* Create Material Modal */}
      <Modal
        title="Добавить материал"
        open={createModalVisible}
        onOk={handleCreate}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        okText="Добавить"
        cancelText="Отмена"
        confirmLoading={createLoading}
        width={600}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="name"
            label="Наименование материала"
            rules={[{ required: true, message: 'Введите наименование' }]}
          >
            <Input placeholder="Бетон В25 F150 W6" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="brand" label="Марка / бренд">
                <Input placeholder="В25" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="manufacturer" label="Производитель">
                <Input placeholder="ООО Бетонный завод" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="batchNumber" label="Номер партии">
                <Input placeholder="2024-1015" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="supplier" label="Поставщик">
                <Input placeholder="ООО Стройснаб" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="arrivalDate" label="Дата поставки">
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="quantity" label="Количество">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="unit" label="Ед. изм.">
                <Input placeholder="м³" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="status" label="Статус" initialValue="DELIVERED">
            <Select
              options={Object.entries(MATERIAL_STATUS_CONFIG).map(([value, cfg]) => ({
                value,
                label: cfg.label,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Material Detail Drawer */}
      <Drawer
        title={selectedMaterial?.name || 'Материал'}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setSelectedMaterial(null);
        }}
        width={750}
      >
        <Spin spinning={detailLoading}>
          {selectedMaterial && (
            <Tabs
              defaultActiveKey="info"
              items={[
                {
                  key: 'info',
                  label: 'Информация',
                  children: (
                    <Descriptions bordered column={2} size="small">
                      <Descriptions.Item label="Наименование" span={2}>
                        {selectedMaterial.name}
                      </Descriptions.Item>
                      <Descriptions.Item label="Марка">
                        {selectedMaterial.brand || '—'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Производитель">
                        {selectedMaterial.manufacturer || '—'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Партия">
                        {selectedMaterial.batchNumber || '—'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Поставщик">
                        {selectedMaterial.supplier || '—'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Дата поставки">
                        {selectedMaterial.arrivalDate
                          ? dayjs(selectedMaterial.arrivalDate).format('DD.MM.YYYY')
                          : '—'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Количество">
                        {selectedMaterial.quantity
                          ? `${selectedMaterial.quantity} ${selectedMaterial.unit || ''}`
                          : '—'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Статус" span={2}>
                        <Tag color={MATERIAL_STATUS_CONFIG[selectedMaterial.status].color}>
                          {MATERIAL_STATUS_CONFIG[selectedMaterial.status].label}
                        </Tag>
                      </Descriptions.Item>
                    </Descriptions>
                  ),
                },
                {
                  key: 'certificates',
                  label: (
                    <Space>
                      <SafetyCertificateOutlined />
                      Сертификаты ({selectedMaterial.certificates?.length || 0})
                    </Space>
                  ),
                  children: (
                    <div>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setCertModalVisible(true)}
                        style={{ marginBottom: 16 }}
                      >
                        Добавить сертификат
                      </Button>
                      <List
                        dataSource={selectedMaterial.certificates || []}
                        locale={{ emptyText: 'Нет сертификатов' }}
                        renderItem={(cert: MaterialCertificate) => (
                          <List.Item
                            actions={[
                              cert.fileUrl && (
                                <Button
                                  key="download"
                                  type="link"
                                  icon={<DownloadOutlined />}
                                  href={cert.fileUrl}
                                  target="_blank"
                                >
                                  Скачать
                                </Button>
                              ),
                            ].filter(Boolean)}
                          >
                            <List.Item.Meta
                              avatar={<SafetyCertificateOutlined style={{ fontSize: 24 }} />}
                              title={CERT_TYPE_LABELS[cert.type] || cert.type}
                              description={
                                <Space direction="vertical" size={0}>
                                  {cert.number && <Text>№ {cert.number}</Text>}
                                  {cert.issuer && <Text type="secondary">Выдан: {cert.issuer}</Text>}
                                  {cert.issueDate && (
                                    <Text type="secondary">
                                      Дата: {dayjs(cert.issueDate).format('DD.MM.YYYY')}
                                      {cert.expiryDate &&
                                        ` — ${dayjs(cert.expiryDate).format('DD.MM.YYYY')}`}
                                    </Text>
                                  )}
                                </Space>
                              }
                            />
                          </List.Item>
                        )}
                      />
                    </div>
                  ),
                },
                {
                  key: 'control',
                  label: (
                    <Space>
                      <ExperimentOutlined />
                      Входной контроль ({selectedMaterial.incomingControls?.length || 0})
                    </Space>
                  ),
                  children: (
                    <div>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setControlModalVisible(true)}
                        style={{ marginBottom: 16 }}
                      >
                        Добавить запись контроля
                      </Button>
                      <List
                        dataSource={selectedMaterial.incomingControls || []}
                        locale={{ emptyText: 'Контроль не проводился' }}
                        renderItem={(ctrl: IncomingControl) => {
                          const resCfg = INSPECTION_RESULT_CONFIG[ctrl.result];
                          return (
                            <Card size="small" style={{ marginBottom: 8 }}>
                              <Descriptions size="small" column={2}>
                                <Descriptions.Item label="Дата">
                                  {dayjs(ctrl.inspectionDate).format('DD.MM.YYYY')}
                                </Descriptions.Item>
                                <Descriptions.Item label="Результат">
                                  <Tag color={resCfg.color}>{resCfg.label}</Tag>
                                </Descriptions.Item>
                                {ctrl.visualCheck && (
                                  <Descriptions.Item label="Визуальный осмотр" span={2}>
                                    {ctrl.visualCheck}
                                  </Descriptions.Item>
                                )}
                                {ctrl.measurements && (
                                  <Descriptions.Item label="Замеры" span={2}>
                                    {ctrl.measurements}
                                  </Descriptions.Item>
                                )}
                                {ctrl.notes && (
                                  <Descriptions.Item label="Примечания" span={2}>
                                    {ctrl.notes}
                                  </Descriptions.Item>
                                )}
                                {ctrl.inspector && (
                                  <Descriptions.Item label="Инспектор" span={2}>
                                    {ctrl.inspector.fullName}
                                  </Descriptions.Item>
                                )}
                              </Descriptions>
                            </Card>
                          );
                        }}
                      />
                    </div>
                  ),
                },
              ]}
            />
          )}
        </Spin>
      </Drawer>

      {/* Certificate Modal */}
      <Modal
        title="Добавить сертификат"
        open={certModalVisible}
        onOk={handleAddCertificate}
        onCancel={() => {
          setCertModalVisible(false);
          certForm.resetFields();
        }}
        okText="Добавить"
        cancelText="Отмена"
        confirmLoading={certLoading}
        width={600}
      >
        <Form form={certForm} layout="vertical">
          <Form.Item
            name="type"
            label="Тип сертификата"
            rules={[{ required: true, message: 'Выберите тип' }]}
          >
            <Select
              placeholder="Выберите тип"
              options={Object.entries(CERT_TYPE_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="number" label="Номер">
                <Input placeholder="СС-2024/1234" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="issuer" label="Кем выдан">
                <Input placeholder="Орган сертификации" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="issueDate" label="Дата выдачи">
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="expiryDate" label="Дата окончания">
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Incoming Control Modal */}
      <Modal
        title="Запись входного контроля"
        open={controlModalVisible}
        onOk={handleAddControl}
        onCancel={() => {
          setControlModalVisible(false);
          controlForm.resetFields();
        }}
        okText="Сохранить"
        cancelText="Отмена"
        confirmLoading={controlLoading}
        width={600}
      >
        <Form form={controlForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="inspectionDate"
                label="Дата проверки"
                rules={[{ required: true, message: 'Укажите дату' }]}
                initialValue={dayjs()}
              >
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="result"
                label="Результат"
                rules={[{ required: true, message: 'Выберите результат' }]}
              >
                <Select
                  placeholder="Выберите результат"
                  options={Object.entries(INSPECTION_RESULT_CONFIG).map(([value, cfg]) => ({
                    value,
                    label: cfg.label,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="visualCheck" label="Визуальный осмотр">
            <Input.TextArea rows={2} placeholder="Результаты визуального осмотра" />
          </Form.Item>
          <Form.Item name="measurements" label="Замеры и измерения">
            <Input.TextArea rows={2} placeholder="Результаты замеров" />
          </Form.Item>
          <Form.Item name="notes" label="Примечания">
            <Input.TextArea rows={2} placeholder="Дополнительные примечания" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Materials;

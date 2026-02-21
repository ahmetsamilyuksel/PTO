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
  message,
  Drawer,
  Descriptions,
  Steps,
  List,
  Row,
  Col,
  Spin,
  Checkbox,
  Card,
  Divider,
  Empty,
  Statistic,
} from 'antd';
import {
  PlusOutlined,
  FolderOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  FileZipOutlined,
  OrderedListOutlined,
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import apiClient from '../api/client';
import type { Package, PackageStatus, Document } from '../types';

const { Title, Text } = Typography;

const PACKAGE_STATUS_CONFIG: Record<PackageStatus, { color: string; label: string }> = {
  DRAFT: { color: 'default', label: 'Черновик' },
  IN_PROGRESS: { color: 'blue', label: 'Формируется' },
  COMPLETE: { color: 'green', label: 'Готов' },
  SUBMITTED: { color: 'purple', label: 'Передан' },
  ACCEPTED: { color: 'cyan', label: 'Принят' },
};

const Packages: React.FC = () => {
  const { id: projectId } = useParams();

  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(false);

  // Wizard
  const [wizardVisible, setWizardVisible] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardForm] = Form.useForm();
  const [wizardLoading, setWizardLoading] = useState(false);

  // Available documents for package
  const [availableDocs, setAvailableDocs] = useState<Document[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  // Detail drawer
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchPackages = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const response = await apiClient.get(`/projects/${projectId}/packages`);
      const data = response.data;
      setPackages(data.data || data || []);
    } catch {
      message.error('Ошибка загрузки комплектов');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const fetchAvailableDocuments = async () => {
    if (!projectId) return;
    setDocsLoading(true);
    try {
      const values = wizardForm.getFieldsValue();
      const params: Record<string, string> = { status: 'SIGNED' };
      if (values.periodStart) params.dateFrom = values.periodStart.format('YYYY-MM-DD');
      if (values.periodEnd) params.dateTo = values.periodEnd.format('YYYY-MM-DD');

      const response = await apiClient.get(`/projects/${projectId}/documents`, { params });
      const data = response.data;
      const docs = data.data || data || [];
      setAvailableDocs(docs);
      setSelectedDocIds(docs.map((d: Document) => d.id));
    } catch {
      message.error('Ошибка загрузки документов');
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
    } catch {
      message.error('Ошибка загрузки комплекта');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreatePackage = async () => {
    try {
      const values = await wizardForm.validateFields();
      setWizardLoading(true);
      const payload = {
        projectId,
        name: values.name,
        number: values.number,
        description: values.description,
        periodStart: values.periodStart?.format('YYYY-MM-DD'),
        periodEnd: values.periodEnd?.format('YYYY-MM-DD'),
        documentIds: selectedDocIds,
      };
      await apiClient.post(`/projects/${projectId}/packages`, payload);
      message.success('Комплект создан');
      setWizardVisible(false);
      wizardForm.resetFields();
      setWizardStep(0);
      setSelectedDocIds([]);
      setAvailableDocs([]);
      fetchPackages();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; errorFields?: unknown };
      if (!err.errorFields) {
        message.error(err.response?.data?.message || 'Ошибка создания комплекта');
      }
    } finally {
      setWizardLoading(false);
    }
  };

  const handleDownloadZip = async (packageId: string) => {
    try {
      const response = await apiClient.get(`/packages/${packageId}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `package-${packageId}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('Ошибка скачивания комплекта');
    }
  };

  const handleDownloadInventory = async (packageId: string) => {
    try {
      const response = await apiClient.get(`/packages/${packageId}/inventory`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `inventory-${packageId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('Ошибка скачивания описи');
    }
  };

  const columns = [
    {
      title: 'Номер',
      dataIndex: 'number',
      key: 'number',
      width: 120,
      render: (text: string) => <Text strong>{text || '—'}</Text>,
    },
    {
      title: 'Наименование',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: 'Период',
      key: 'period',
      width: 200,
      render: (_: unknown, record: Package) => {
        if (record.periodStart && record.periodEnd) {
          return `${dayjs(record.periodStart).format('DD.MM.YYYY')} — ${dayjs(record.periodEnd).format('DD.MM.YYYY')}`;
        }
        if (record.periodStart) return `с ${dayjs(record.periodStart).format('DD.MM.YYYY')}`;
        return 'Весь проект';
      },
    },
    {
      title: 'Документов',
      key: 'docCount',
      width: 110,
      render: (_: unknown, record: Package) => record.documentIds?.length || 0,
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: PackageStatus) => {
        const cfg = PACKAGE_STATUS_CONFIG[status];
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 150,
      render: (_: unknown, record: Package) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => openPackageDetail(record.id)}
            title="Просмотр"
          />
          <Button
            type="link"
            icon={<FileZipOutlined />}
            onClick={() => handleDownloadZip(record.id)}
            title="Скачать ZIP"
          />
          <Button
            type="link"
            icon={<OrderedListOutlined />}
            onClick={() => handleDownloadInventory(record.id)}
            title="Опись"
          />
        </Space>
      ),
    },
  ];

  const wizardSteps = [
    { title: 'Параметры', description: 'Информация о комплекте' },
    { title: 'Документы', description: 'Выбор документов' },
    { title: 'Обзор', description: 'Проверка и создание' },
  ];

  const renderWizardStep = () => {
    switch (wizardStep) {
      case 0:
        return (
          <Form form={wizardForm} layout="vertical" style={{ maxWidth: 500 }}>
            <Form.Item
              name="name"
              label="Наименование комплекта"
              rules={[{ required: true, message: 'Введите наименование' }]}
            >
              <Input placeholder="Комплект ИД за январь 2025" />
            </Form.Item>
            <Form.Item name="number" label="Номер">
              <Input placeholder="КИД-001" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="periodStart" label="Период с">
                  <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="periodEnd" label="Период по">
                  <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="description" label="Описание">
              <Input.TextArea rows={2} placeholder="Описание комплекта" />
            </Form.Item>
          </Form>
        );

      case 1:
        return (
          <Spin spinning={docsLoading}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Card size="small">
                <Statistic
                  title="Выбрано документов"
                  value={selectedDocIds.length}
                  suffix={`/ ${availableDocs.length}`}
                />
              </Card>
              <Checkbox.Group
                value={selectedDocIds}
                onChange={(vals) => setSelectedDocIds(vals as string[])}
                style={{ width: '100%' }}
              >
                <List
                  dataSource={availableDocs}
                  locale={{ emptyText: 'Нет подписанных документов за выбранный период' }}
                  renderItem={(doc: Document) => (
                    <List.Item>
                      <Checkbox value={doc.id} style={{ width: '100%' }}>
                        <Space>
                          <FileTextOutlined />
                          <Text strong>{doc.number}</Text>
                          <Text>{doc.title}</Text>
                          <Tag color="green">Подписан</Tag>
                          <Text type="secondary">
                            {dayjs(doc.createdAt).format('DD.MM.YYYY')}
                          </Text>
                        </Space>
                      </Checkbox>
                    </List.Item>
                  )}
                />
              </Checkbox.Group>
            </Space>
          </Spin>
        );

      case 2:
        return (
          <div>
            <Descriptions bordered column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Наименование">
                {wizardForm.getFieldValue('name') || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Номер">
                {wizardForm.getFieldValue('number') || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Период">
                {wizardForm.getFieldValue('periodStart')
                  ? `${dayjs(wizardForm.getFieldValue('periodStart')).format('DD.MM.YYYY')} — ${
                      wizardForm.getFieldValue('periodEnd')
                        ? dayjs(wizardForm.getFieldValue('periodEnd')).format('DD.MM.YYYY')
                        : '...'
                    }`
                  : 'Весь проект'}
              </Descriptions.Item>
              <Descriptions.Item label="Документов">
                {selectedDocIds.length}
              </Descriptions.Item>
            </Descriptions>

            {selectedDocIds.length > 0 && (
              <Card title="Включённые документы" size="small">
                <List
                  dataSource={availableDocs.filter((d) => selectedDocIds.includes(d.id))}
                  size="small"
                  renderItem={(doc: Document, index: number) => (
                    <List.Item>
                      <Text>
                        {index + 1}. {doc.number} — {doc.title}
                      </Text>
                    </List.Item>
                  )}
                />
              </Card>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const handleWizardNext = async () => {
    if (wizardStep === 0) {
      try {
        await wizardForm.validateFields();
      } catch {
        return;
      }
      await fetchAvailableDocuments();
    }
    setWizardStep(wizardStep + 1);
  };

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            Комплекты документации
          </Title>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setWizardVisible(true)}
          >
            Создать комплект
          </Button>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={packages}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      {/* Create Package Wizard */}
      <Modal
        title="Создать комплект документации"
        open={wizardVisible}
        onCancel={() => {
          setWizardVisible(false);
          wizardForm.resetFields();
          setWizardStep(0);
          setSelectedDocIds([]);
          setAvailableDocs([]);
        }}
        width={800}
        footer={
          <Space>
            {wizardStep > 0 && (
              <Button onClick={() => setWizardStep(wizardStep - 1)}>Назад</Button>
            )}
            <Button
              onClick={() => {
                setWizardVisible(false);
                wizardForm.resetFields();
                setWizardStep(0);
              }}
            >
              Отмена
            </Button>
            {wizardStep < wizardSteps.length - 1 ? (
              <Button type="primary" onClick={handleWizardNext}>
                Далее
              </Button>
            ) : (
              <Button
                type="primary"
                loading={wizardLoading}
                onClick={handleCreatePackage}
                icon={<CheckCircleOutlined />}
              >
                Создать комплект
              </Button>
            )}
          </Space>
        }
      >
        <Steps
          current={wizardStep}
          items={wizardSteps}
          size="small"
          style={{ marginBottom: 24 }}
        />
        {renderWizardStep()}
      </Modal>

      {/* Package Detail Drawer */}
      <Drawer
        title={selectedPackage ? `${selectedPackage.number || ''} ${selectedPackage.name}` : 'Комплект'}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setSelectedPackage(null);
        }}
        width={700}
        extra={
          selectedPackage && (
            <Space>
              <Button
                icon={<FileZipOutlined />}
                onClick={() => handleDownloadZip(selectedPackage.id)}
              >
                Скачать ZIP
              </Button>
              <Button
                icon={<OrderedListOutlined />}
                onClick={() => handleDownloadInventory(selectedPackage.id)}
              >
                Опись
              </Button>
            </Space>
          )
        }
      >
        <Spin spinning={detailLoading}>
          {selectedPackage && (
            <>
              <Descriptions bordered column={2} size="small" style={{ marginBottom: 24 }}>
                <Descriptions.Item label="Наименование" span={2}>
                  {selectedPackage.name}
                </Descriptions.Item>
                <Descriptions.Item label="Номер">
                  {selectedPackage.number || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Статус">
                  <Tag color={PACKAGE_STATUS_CONFIG[selectedPackage.status].color}>
                    {PACKAGE_STATUS_CONFIG[selectedPackage.status].label}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Период">
                  {selectedPackage.periodStart
                    ? `${dayjs(selectedPackage.periodStart).format('DD.MM.YYYY')} — ${
                        selectedPackage.periodEnd
                          ? dayjs(selectedPackage.periodEnd).format('DD.MM.YYYY')
                          : '...'
                      }`
                    : 'Весь проект'}
                </Descriptions.Item>
                <Descriptions.Item label="Документов">
                  {selectedPackage.documentIds?.length || 0}
                </Descriptions.Item>
                {selectedPackage.description && (
                  <Descriptions.Item label="Описание" span={2}>
                    {selectedPackage.description}
                  </Descriptions.Item>
                )}
              </Descriptions>

              <Divider orientation="left">Документы в комплекте</Divider>

              {selectedPackage.documents && selectedPackage.documents.length > 0 ? (
                <List
                  dataSource={selectedPackage.documents}
                  renderItem={(doc: Document, index: number) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<FileTextOutlined style={{ fontSize: 20 }} />}
                        title={`${index + 1}. ${doc.number} — ${doc.title}`}
                        description={
                          <Space>
                            <Tag>{doc.type}</Tag>
                            <Tag color="green">Подписан</Tag>
                            <Text type="secondary">
                              {dayjs(doc.createdAt).format('DD.MM.YYYY')}
                            </Text>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="Нет документов" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </>
          )}
        </Spin>
      </Drawer>
    </div>
  );
};

export default Packages;

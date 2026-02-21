import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Modal,
  Form,
  Select,
  Input,
  DatePicker,
  message,
  Drawer,
  Descriptions,
  Tabs,
  Timeline,
  List,
  Popconfirm,
  Row,
  Col,
  Spin,
  Upload,
} from 'antd';
import {
  PlusOutlined,
  FileTextOutlined,
  EditOutlined,
  SendOutlined,
  CheckOutlined,
  DownloadOutlined,
  EyeOutlined,
  CloseCircleOutlined,
  UploadOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { useParams, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import apiClient from '../api/client';
import type {
  Document,
  DocumentStatus,
  Location,
  WorkItem,
  DocumentTemplate,
  Attachment,
  WorkflowTransition,
} from '../types';
import DocumentForm from '../components/DocumentForm';
import WorkflowStatus from '../components/WorkflowStatus';
import FileUpload from '../components/FileUpload';

const { Title, Text } = Typography;
const { Dragger } = Upload;

const STATUS_CONFIG: Record<DocumentStatus | string, { color: string; label: string }> = {
  DRAFT: { color: 'gold', label: 'Черновик' },
  IN_REVIEW: { color: 'blue', label: 'На проверке' },
  PENDING_SIGNATURE: { color: 'purple', label: 'На подписи' },
  SIGNED: { color: 'green', label: 'Подписан' },
  REJECTED: { color: 'red', label: 'Отклонён' },
  ARCHIVED: { color: 'default', label: 'Архив' },
};

const DOCUMENT_EVENTS = [
  {
    key: 'material_arrived',
    label: 'Поступил материал',
    suggestedType: 'Акт входного контроля',
    category: 'ACT',
  },
  {
    key: 'hidden_work',
    label: 'Закрытие скрытых работ',
    suggestedType: 'Акт освидетельствования скрытых работ',
    category: 'ACT',
  },
  {
    key: 'test_performed',
    label: 'Проведено испытание',
    suggestedType: 'Протокол испытаний',
    category: 'PROTOCOL',
  },
  {
    key: 'section_handover',
    label: 'Сдача участка',
    suggestedType: 'Акт приёмки выполненных работ',
    category: 'ACT',
  },
];

const Documents: React.FC = () => {
  const { id: projectId } = useParams();
  const [searchParams] = useSearchParams();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [filterType, setFilterType] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [filterLocation, setFilterLocation] = useState<string | undefined>();
  const [filterDateRange, setFilterDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  // Create modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<string | undefined>();
  const [createForm] = Form.useForm();
  const [createLoading, setCreateLoading] = useState(false);

  // Detail drawer
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editForm] = Form.useForm();

  // Action modals
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionType, setActionType] = useState<string>('');
  const [actionComment, setActionComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDocuments = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, pageSize };
      if (filterType) params.type = filterType;
      if (filterStatus) params.status = filterStatus;
      if (filterLocation) params.locationId = filterLocation;
      if (filterDateRange) {
        params.dateFrom = filterDateRange[0].format('YYYY-MM-DD');
        params.dateTo = filterDateRange[1].format('YYYY-MM-DD');
      }
      const response = await apiClient.get(`/projects/${projectId}/documents`, { params });
      const data = response.data;
      setDocuments(data.data || data || []);
      setTotal(data.total || 0);
    } catch {
      message.error('Ошибка загрузки документов');
    } finally {
      setLoading(false);
    }
  }, [projectId, page, pageSize, filterType, filterStatus, filterLocation, filterDateRange]);

  const fetchMeta = useCallback(async () => {
    if (!projectId) return;
    try {
      const [locsRes, wiRes, tmplRes] = await Promise.all([
        apiClient.get(`/projects/${projectId}/locations`).catch(() => ({ data: [] })),
        apiClient.get(`/projects/${projectId}/work-items`).catch(() => ({ data: [] })),
        apiClient.get('/document-templates').catch(() => ({ data: [] })),
      ]);
      setLocations(locsRes.data.data || locsRes.data || []);
      setWorkItems(wiRes.data.data || wiRes.data || []);
      setTemplates(tmplRes.data.data || tmplRes.data || []);
    } catch {
      // ignore
    }
  }, [projectId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  // Handle URL params for create/view
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setCreateModalVisible(true);
      const type = searchParams.get('type');
      const location = searchParams.get('location');
      if (type) createForm.setFieldValue('type', type);
      if (location) createForm.setFieldValue('locationId', location);
    }
    const docId = searchParams.get('doc');
    if (docId) {
      openDocumentDetail(docId);
    }
  }, [searchParams]);

  const openDocumentDetail = async (docId: string) => {
    setDetailLoading(true);
    setDetailDrawerVisible(true);
    try {
      const response = await apiClient.get(`/documents/${docId}`);
      setSelectedDocument(response.data);
    } catch {
      message.error('Ошибка загрузки документа');
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
        formData: values.formData || {},
      };

      await apiClient.post(`/projects/${projectId}/documents`, payload);
      message.success('Документ создан');
      setCreateModalVisible(false);
      createForm.resetFields();
      setSelectedEvent(undefined);
      fetchDocuments();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; errorFields?: unknown };
      if (!err.errorFields) {
        message.error(err.response?.data?.message || 'Ошибка создания документа');
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedDocument) return;
    try {
      const values = await editForm.validateFields();
      await apiClient.patch(`/documents/${selectedDocument.id}`, values);
      message.success('Документ обновлён');
      setEditMode(false);
      openDocumentDetail(selectedDocument.id);
      fetchDocuments();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Ошибка обновления');
    }
  };

  const handleAction = async () => {
    if (!selectedDocument) return;
    setActionLoading(true);
    try {
      await apiClient.post(`/documents/${selectedDocument.id}/transition`, {
        action: actionType,
        comment: actionComment,
      });
      message.success('Действие выполнено');
      setActionModalVisible(false);
      setActionComment('');
      openDocumentDetail(selectedDocument.id);
      fetchDocuments();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Ошибка выполнения действия');
    } finally {
      setActionLoading(false);
    }
  };

  const flattenLocations = (locs: Location[]): { id: string; name: string }[] => {
    const result: { id: string; name: string }[] = [];
    const flatten = (items: Location[], prefix: string) => {
      items.forEach((item) => {
        const label = prefix ? `${prefix} > ${item.name}` : item.name;
        result.push({ id: item.id, name: label });
        if (item.children) flatten(item.children, label);
      });
    };
    flatten(locs, '');
    return result;
  };

  const flatLocs = flattenLocations(locations);
  const documentTypes = [...new Set(documents.map((d) => d.type))];

  const columns = [
    {
      title: '№',
      dataIndex: 'number',
      key: 'number',
      width: 120,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Тип',
      dataIndex: 'type',
      key: 'type',
      width: 200,
    },
    {
      title: 'Наименование',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: 'Зона',
      key: 'location',
      width: 150,
      render: (_: unknown, record: Document) => record.location?.name || '—',
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: DocumentStatus) => {
        const cfg = STATUS_CONFIG[status] || { color: 'default', label: status };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Дата',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 110,
      render: (date: string) => dayjs(date).format('DD.MM.YYYY'),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: Document) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => openDocumentDetail(record.id)}
          />
          {record.generatedFileUrl && (
            <Button
              type="link"
              icon={<DownloadOutlined />}
              href={record.generatedFileUrl}
              target="_blank"
            />
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            Документы
          </Title>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            Создать документ
          </Button>
        </Col>
      </Row>

      {/* Filters */}
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          value={filterType}
          onChange={setFilterType}
          allowClear
          placeholder="Тип документа"
          style={{ width: 220 }}
          options={documentTypes.map((t) => ({ value: t, label: t }))}
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
        <Select
          value={filterLocation}
          onChange={setFilterLocation}
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Зона"
          style={{ width: 200 }}
          options={flatLocs.map((l) => ({ value: l.id, label: l.name }))}
        />
        <DatePicker.RangePicker
          value={filterDateRange}
          onChange={(dates) => setFilterDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
          format="DD.MM.YYYY"
          placeholder={['Дата от', 'Дата до']}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={documents}
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

      {/* Create Document Modal */}
      <Modal
        title="Создать документ"
        open={createModalVisible}
        onOk={handleCreate}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
          setSelectedEvent(undefined);
        }}
        okText="Создать"
        cancelText="Отмена"
        confirmLoading={createLoading}
        width={700}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item label="Событие">
            <Select
              value={selectedEvent}
              onChange={(value) => {
                setSelectedEvent(value);
                const event = DOCUMENT_EVENTS.find((e) => e.key === value);
                if (event) {
                  createForm.setFieldsValue({
                    type: event.suggestedType,
                    category: event.category,
                  });
                }
              }}
              allowClear
              placeholder="Выберите событие (необязательно)"
              options={DOCUMENT_EVENTS.map((e) => ({
                value: e.key,
                label: e.label,
              }))}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="type"
                label="Тип документа"
                rules={[{ required: true, message: 'Укажите тип' }]}
              >
                <Input placeholder="Акт освидетельствования скрытых работ" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="category"
                label="Категория"
                rules={[{ required: true, message: 'Выберите категорию' }]}
              >
                <Select
                  placeholder="Категория"
                  options={[
                    { value: 'ACT', label: 'Акт' },
                    { value: 'PROTOCOL', label: 'Протокол' },
                    { value: 'JOURNAL', label: 'Журнал' },
                    { value: 'CERTIFICATE', label: 'Сертификат' },
                    { value: 'PERMIT', label: 'Разрешение' },
                    { value: 'DRAWING', label: 'Чертёж' },
                    { value: 'SPECIFICATION', label: 'Спецификация' },
                    { value: 'REPORT', label: 'Отчёт' },
                    { value: 'ORDER', label: 'Приказ' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="title"
            label="Наименование"
            rules={[{ required: true, message: 'Введите наименование' }]}
          >
            <Input placeholder="Акт освидетельствования скрытых работ по устройству..." />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="locationId" label="Зона/участок">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Выберите зону"
                  options={flatLocs.map((l) => ({ value: l.id, label: l.name }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="workItemId" label="Вид работ">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Выберите работу"
                  options={workItems.map((w) => ({
                    value: w.id,
                    label: w.code ? `${w.code}: ${w.name}` : w.name,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="templateId" label="Шаблон">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Выберите шаблон (необязательно)"
              options={templates.map((t) => ({
                value: t.id,
                label: t.name,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Document Detail Drawer */}
      <Drawer
        title={selectedDocument ? `${selectedDocument.number} — ${selectedDocument.title}` : 'Документ'}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setSelectedDocument(null);
          setEditMode(false);
        }}
        width={800}
        extra={
          selectedDocument && (
            <Space>
              {selectedDocument.status === 'DRAFT' && (
                <>
                  <Button
                    icon={<EditOutlined />}
                    onClick={() => setEditMode(!editMode)}
                  >
                    {editMode ? 'Отмена' : 'Редактировать'}
                  </Button>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={() => {
                      setActionType('SUBMIT');
                      setActionModalVisible(true);
                    }}
                  >
                    На проверку
                  </Button>
                </>
              )}
              {selectedDocument.status === 'IN_REVIEW' && (
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={() => {
                    setActionType('APPROVE');
                    setActionModalVisible(true);
                  }}
                >
                  Утвердить
                </Button>
              )}
              {selectedDocument.status === 'PENDING_SIGNATURE' && (
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={() => {
                    setActionType('SIGN');
                    setActionModalVisible(true);
                  }}
                >
                  Подписать
                </Button>
              )}
              {(selectedDocument.status === 'IN_REVIEW' ||
                selectedDocument.status === 'PENDING_SIGNATURE') && (
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => {
                    setActionType('REJECT');
                    setActionModalVisible(true);
                  }}
                >
                  Отклонить
                </Button>
              )}
              {selectedDocument.generatedFileUrl && (
                <Button
                  icon={<DownloadOutlined />}
                  href={selectedDocument.generatedFileUrl}
                  target="_blank"
                >
                  PDF
                </Button>
              )}
            </Space>
          )
        }
      >
        <Spin spinning={detailLoading}>
          {selectedDocument && (
            <Tabs
              defaultActiveKey="info"
              items={[
                {
                  key: 'info',
                  label: 'Информация',
                  children: editMode ? (
                    <div>
                      <DocumentForm
                        form={editForm}
                        documentType={selectedDocument.type}
                        initialValues={selectedDocument.formData as Record<string, unknown>}
                        templateFields={selectedDocument.template?.formSchema}
                      />
                      <Button type="primary" onClick={handleEdit} style={{ marginTop: 16 }}>
                        Сохранить
                      </Button>
                    </div>
                  ) : (
                    <Descriptions bordered column={1} size="small">
                      <Descriptions.Item label="Номер">
                        {selectedDocument.number}
                      </Descriptions.Item>
                      <Descriptions.Item label="Тип">
                        {selectedDocument.type}
                      </Descriptions.Item>
                      <Descriptions.Item label="Категория">
                        {selectedDocument.category}
                      </Descriptions.Item>
                      <Descriptions.Item label="Статус">
                        <Tag color={STATUS_CONFIG[selectedDocument.status]?.color}>
                          {STATUS_CONFIG[selectedDocument.status]?.label}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Зона">
                        {selectedDocument.location?.name || '—'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Вид работ">
                        {selectedDocument.workItem?.name || '—'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Дата создания">
                        {dayjs(selectedDocument.createdAt).format('DD.MM.YYYY HH:mm')}
                      </Descriptions.Item>
                      {selectedDocument.formData &&
                        Object.entries(selectedDocument.formData).map(([key, value]) => (
                          <Descriptions.Item key={key} label={key}>
                            {String(value)}
                          </Descriptions.Item>
                        ))}
                    </Descriptions>
                  ),
                },
                {
                  key: 'attachments',
                  label: `Вложения (${selectedDocument.attachments?.length || 0})`,
                  children: (
                    <div>
                      <FileUpload
                        entityType="document"
                        entityId={selectedDocument.id}
                        onUploaded={() => openDocumentDetail(selectedDocument.id)}
                      />
                      <List
                        dataSource={selectedDocument.attachments || []}
                        renderItem={(att: Attachment) => (
                          <List.Item
                            actions={[
                              <Button
                                key="download"
                                type="link"
                                icon={<DownloadOutlined />}
                                href={att.fileUrl}
                                target="_blank"
                              >
                                Скачать
                              </Button>,
                            ]}
                          >
                            <List.Item.Meta
                              avatar={<FileTextOutlined />}
                              title={att.fileName}
                              description={`${(att.fileSize / 1024).toFixed(1)} КБ — ${att.type}`}
                            />
                          </List.Item>
                        )}
                      />
                    </div>
                  ),
                },
                {
                  key: 'workflow',
                  label: 'История',
                  children: (
                    <WorkflowStatus
                      transitions={selectedDocument.transitions || []}
                      currentStatus={selectedDocument.status}
                    />
                  ),
                },
              ]}
            />
          )}
        </Spin>
      </Drawer>

      {/* Action Modal */}
      <Modal
        title={
          actionType === 'SUBMIT'
            ? 'Отправить на проверку'
            : actionType === 'APPROVE'
            ? 'Утвердить документ'
            : actionType === 'SIGN'
            ? 'Подписать документ'
            : actionType === 'REJECT'
            ? 'Отклонить документ'
            : 'Действие'
        }
        open={actionModalVisible}
        onOk={handleAction}
        onCancel={() => {
          setActionModalVisible(false);
          setActionComment('');
        }}
        okText="Подтвердить"
        cancelText="Отмена"
        confirmLoading={actionLoading}
        okButtonProps={{
          danger: actionType === 'REJECT',
        }}
      >
        <Form layout="vertical">
          <Form.Item label="Комментарий">
            <Input.TextArea
              value={actionComment}
              onChange={(e) => setActionComment(e.target.value)}
              rows={3}
              placeholder={
                actionType === 'REJECT'
                  ? 'Укажите причину отклонения'
                  : 'Комментарий (необязательно)'
              }
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Documents;

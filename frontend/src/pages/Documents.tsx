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
import { useI18n } from '../i18n';

const { Title, Text } = Typography;
const { Dragger } = Upload;

const Documents: React.FC = () => {
  const { t } = useI18n();

  const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
    DRAFT: { color: 'gold', label: t.doc?.statuses?.DRAFT || 'Taslak' },
    IN_REVIEW: { color: 'blue', label: t.doc?.statuses?.IN_REVIEW || 'İncelemede' },
    PENDING_SIGNATURE: { color: 'purple', label: t.doc?.statuses?.PENDING_SIGNATURE || 'İmza Bekliyor' },
    SIGNED: { color: 'green', label: t.doc?.statuses?.SIGNED || 'İmzalandı' },
    REJECTED: { color: 'red', label: t.doc?.statuses?.REVISION_REQUESTED || 'Reddedildi' },
    ARCHIVED: { color: 'default', label: t.doc?.statuses?.ARCHIVED || 'Arşiv' },
  };

  const DOCUMENT_EVENTS = [
    { key: 'material_arrived', label: t.doc?.events?.materialArrived || 'Malzeme Geldi', suggestedType: t.doc?.types?.INCOMING_CONTROL_ACT || 'Giriş Kontrol Aktı', category: 'ACT' },
    { key: 'hidden_work', label: t.doc?.events?.hiddenWorkClosed || 'Gizli İş Kapatılacak', suggestedType: t.doc?.types?.AOSR || 'АОСР', category: 'ACT' },
    { key: 'test_performed', label: t.doc?.events?.testPerformed || 'Test Yapıldı', suggestedType: t.doc?.types?.TEST_PROTOCOL || 'Test Protokolü', category: 'PROTOCOL' },
    { key: 'section_handover', label: t.doc?.events?.sectionHandover || 'Bölüm Teslim', suggestedType: t.doc?.types?.COMPLETION_ACT || 'İş Bitirme Aktı', category: 'ACT' },
  ];
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
      const params: Record<string, unknown> = { projectId, page, limit: pageSize };
      if (filterType) params.documentType = filterType;
      if (filterStatus) params.status = filterStatus;
      if (filterLocation) params.locationId = filterLocation;
      if (filterDateRange) {
        params.dateFrom = filterDateRange[0].format('YYYY-MM-DD');
        params.dateTo = filterDateRange[1].format('YYYY-MM-DD');
      }
      const response = await apiClient.get('/documents', { params });
      const data = response.data;
      setDocuments(data.data || data || []);
      setTotal(data.total || 0);
    } catch {
      message.error(t.app.error);
    } finally {
      setLoading(false);
    }
  }, [projectId, page, pageSize, filterType, filterStatus, filterLocation, filterDateRange]);

  const fetchMeta = useCallback(async () => {
    if (!projectId) return;
    try {
      const [locsRes, wiRes, tmplRes] = await Promise.all([
        apiClient.get('/locations', { params: { projectId } }).catch(() => ({ data: [] })),
        apiClient.get('/work-items', { params: { projectId } }).catch(() => ({ data: [] })),
        apiClient.get('/templates').catch(() => ({ data: [] })),
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
      message.error(t.app.error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setCreateLoading(true);

      const payload = {
        projectId,
        documentType: values.type,
        title: values.title,
        locationId: values.locationId,
        workItemId: values.workItemId,
        templateId: values.templateId,
        data: values.formData || {},
      };

      await apiClient.post('/documents', payload);
      message.success(t.app.success);
      setCreateModalVisible(false);
      createForm.resetFields();
      setSelectedEvent(undefined);
      fetchDocuments();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; errorFields?: unknown };
      if (!err.errorFields) {
        message.error(err.response?.data?.message || t.app.error);
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedDocument) return;
    try {
      const values = await editForm.validateFields();
      await apiClient.put(`/documents/${selectedDocument.id}`, values);
      message.success(t.app.success);
      setEditMode(false);
      openDocumentDetail(selectedDocument.id);
      fetchDocuments();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || t.app.error);
    }
  };

  const handleAction = async () => {
    if (!selectedDocument) return;
    setActionLoading(true);
    try {
      // Map action types to target status
      const actionToStatus: Record<string, string> = {
        SUBMIT: 'IN_REVIEW',
        APPROVE: 'PENDING_SIGNATURE',
        SIGN: 'SIGNED',
        REJECT: 'REVISION_REQUESTED',
      };
      await apiClient.post('/workflow/transition', {
        documentId: selectedDocument.id,
        toStatus: actionToStatus[actionType] || actionType,
        comment: actionComment,
      });
      message.success(t.app.success);
      setActionModalVisible(false);
      setActionComment('');
      openDocumentDetail(selectedDocument.id);
      fetchDocuments();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || t.app.error);
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
      title: t.app.type,
      dataIndex: 'type',
      key: 'type',
      width: 200,
    },
    {
      title: t.app.name,
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: t.doc?.location,
      key: 'location',
      width: 150,
      render: (_: unknown, record: Document) => record.location?.name || '—',
    },
    {
      title: t.app.status,
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: DocumentStatus) => {
        const cfg = STATUS_CONFIG[status] || { color: 'default', label: status };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
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
            {t.doc?.title}
          </Title>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            {t.doc?.createNew}
          </Button>
        </Col>
      </Row>

      {/* Filters */}
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          value={filterType}
          onChange={setFilterType}
          allowClear
          placeholder={t.doc?.type}
          style={{ width: 220 }}
          options={documentTypes.map((t) => ({ value: t, label: t }))}
        />
        <Select
          value={filterStatus}
          onChange={setFilterStatus}
          allowClear
          placeholder={t.app.status}
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
          placeholder={t.doc?.location}
          style={{ width: 200 }}
          options={flatLocs.map((l) => ({ value: l.id, label: l.name }))}
        />
        <DatePicker.RangePicker
          value={filterDateRange}
          onChange={(dates) => setFilterDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
          format="DD.MM.YYYY"
          placeholder={[t.package?.periodFrom || 'Başlangıç', t.package?.periodTo || 'Bitiş']}
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
          showTotal: (totalCount) => `${totalCount} ${t.tasks?.items || 'kayıt'}`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      {/* Create Document Modal */}
      <Modal
        title={t.doc?.createNew}
        open={createModalVisible}
        onOk={handleCreate}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
          setSelectedEvent(undefined);
        }}
        okText={t.app.create}
        cancelText={t.app.cancel}
        confirmLoading={createLoading}
        width={700}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item label={t.doc?.fromEvent}>
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
              placeholder={t.doc?.fromEvent}
              options={DOCUMENT_EVENTS.map((e) => ({
                value: e.key,
                label: e.label,
              }))}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="type" label={t.doc?.type} rules={[{ required: true, message: t.app.required }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="category" label={t.categories?.title || 'Kategori'} rules={[{ required: true, message: t.app.required }]}>
                <Select
                  placeholder={t.categories?.title}
                  options={[
                    { value: 'ACT', label: t.doc?.types?.AOSR?.split('(')[0]?.trim() || 'Akt' },
                    { value: 'PROTOCOL', label: t.doc?.types?.TEST_PROTOCOL || 'Protokol' },
                    { value: 'JOURNAL', label: t.menu?.journals || 'Günlük' },
                    { value: 'CERTIFICATE', label: t.material?.certificates?.split('/')[0]?.trim() || 'Sertifika' },
                    { value: 'PERMIT', label: 'İzin Belgesi' },
                    { value: 'DRAWING', label: t.doc?.types?.EXECUTIVE_DRAWING || 'Çizim' },
                    { value: 'SPECIFICATION', label: 'Şartname' },
                    { value: 'REPORT', label: 'Rapor' },
                    { value: 'ORDER', label: 'Emir' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="title" label={t.doc?.docTitle || t.app.name} rules={[{ required: true, message: t.app.required }]}>
            <Input />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="locationId" label={t.doc?.location}>
                <Select allowClear showSearch optionFilterProp="label" placeholder={t.doc?.location}
                  options={flatLocs.map((l) => ({ value: l.id, label: l.name }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="workItemId" label={t.doc?.workItem}>
                <Select allowClear showSearch optionFilterProp="label" placeholder={t.doc?.workItem}
                  options={workItems.map((w) => ({ value: w.id, label: w.code ? `${w.code}: ${w.name}` : w.name }))} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="templateId" label={t.menu?.templates || 'Şablon'}>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder={t.menu?.templates}
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
        title={selectedDocument ? `${selectedDocument.number} — ${selectedDocument.title}` : t.doc?.title}
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
                    {editMode ? t.app.cancel : t.app.edit}
                  </Button>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={() => {
                      setActionType('SUBMIT');
                      setActionModalVisible(true);
                    }}
                  >
                    {t.doc?.sendToReview}
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
                  {t.doc?.sendToSign}
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
                  {t.doc?.sign}
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
                  {t.doc?.reject}
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
                  label: t.app.description,
                  children: editMode ? (
                    <div>
                      <DocumentForm
                        form={editForm}
                        documentType={selectedDocument.type}
                        initialValues={selectedDocument.formData as Record<string, unknown>}
                        templateFields={selectedDocument.template?.formSchema}
                      />
                      <Button type="primary" onClick={handleEdit} style={{ marginTop: 16 }}>
                        {t.app.save}
                      </Button>
                    </div>
                  ) : (
                    <Descriptions bordered column={1} size="small">
                      <Descriptions.Item label={t.doc?.number}>
                        {selectedDocument.number}
                      </Descriptions.Item>
                      <Descriptions.Item label={t.app.type}>
                        {selectedDocument.type}
                      </Descriptions.Item>
                      <Descriptions.Item label={t.categories?.title || 'Kategori'}>
                        {selectedDocument.category}
                      </Descriptions.Item>
                      <Descriptions.Item label={t.app.status}>
                        <Tag color={STATUS_CONFIG[selectedDocument.status]?.color}>
                          {STATUS_CONFIG[selectedDocument.status]?.label}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label={t.doc?.location}>
                        {selectedDocument.location?.name || '—'}
                      </Descriptions.Item>
                      <Descriptions.Item label={t.doc?.workItem}>
                        {selectedDocument.workItem?.name || '—'}
                      </Descriptions.Item>
                      <Descriptions.Item label={t.doc?.date}>
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
                  label: `${t.doc?.attachments || 'Ekler'} (${selectedDocument.attachments?.length || 0})`,
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
                                {t.app.download}
                              </Button>,
                            ]}
                          >
                            <List.Item.Meta
                              avatar={<FileTextOutlined />}
                              title={att.fileName}
                              description={`${(att.fileSize / 1024).toFixed(1)} KB — ${att.type}`}
                            />
                          </List.Item>
                        )}
                      />
                    </div>
                  ),
                },
                {
                  key: 'workflow',
                  label: t.doc?.workflow || 'Geçmiş',
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
            ? t.doc?.sendToReview
            : actionType === 'APPROVE'
            ? t.doc?.sendToSign
            : actionType === 'SIGN'
            ? t.doc?.sign
            : actionType === 'REJECT'
            ? t.doc?.reject
            : t.app.actions
        }
        open={actionModalVisible}
        onOk={handleAction}
        onCancel={() => {
          setActionModalVisible(false);
          setActionComment('');
        }}
        okText={t.app.confirm}
        cancelText={t.app.cancel}
        confirmLoading={actionLoading}
        okButtonProps={{
          danger: actionType === 'REJECT',
        }}
      >
        <Form layout="vertical">
          <Form.Item label={t.corrections?.comments || 'Yorum'}>
            <Input.TextArea
              value={actionComment}
              onChange={(e) => setActionComment(e.target.value)}
              rows={3}
              placeholder={
                actionType === 'REJECT'
                  ? (t.corrections?.enterResolution || 'Red nedenini belirtin')
                  : (t.corrections?.addComment || 'Yorum ekle...')
              }
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Documents;

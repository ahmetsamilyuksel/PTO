import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, Tag, Space,
  message, Popconfirm, Typography, Switch, Badge, Descriptions, Upload,
} from 'antd';
import type { UploadFile } from 'antd';
import {
  PlusOutlined, FileTextOutlined, DeleteOutlined, EditOutlined,
  EyeOutlined, SnippetsOutlined, UploadOutlined, InboxOutlined,
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import apiClient, { getApiError } from '../api/client';
import { useI18n } from '../i18n';

const { Text } = Typography;

const CustomTemplates: React.FC = () => {
  const { id: projectId } = useParams();
  const { t } = useI18n();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editTemplate, setEditTemplate] = useState<any>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [form] = Form.useForm();

  useEffect(() => {
    if (projectId) fetchTemplates();
  }, [projectId]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/custom-templates', { params: { projectId } });
      setTemplates(res.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const fetchDetail = async (id: string) => {
    try {
      const res = await apiClient.get(`/custom-templates/${id}`);
      setSelectedTemplate(res.data);
      setDetailVisible(true);
    } catch { /* ignore */ }
  };

  const handleSave = async (values: any) => {
    try {
      if (editTemplate) {
        // Edit mode: update metadata only (no file re-upload)
        const { file, ...rest } = values;
        await apiClient.put(`/custom-templates/${editTemplate.id}`, rest);
      } else {
        // Create mode: send file + metadata via FormData
        const formData = new FormData();
        formData.append('projectId', projectId || '');
        formData.append('name', values.name);
        if (values.description) formData.append('description', values.description);
        if (values.documentType) formData.append('documentType', values.documentType);
        if (values.format) formData.append('format', values.format);

        if (fileList.length > 0 && fileList[0].originFileObj) {
          formData.append('file', fileList[0].originFileObj);
        }

        await apiClient.post('/custom-templates', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      message.success(t.app.success);
      setModalVisible(false);
      setEditTemplate(null);
      setFileList([]);
      form.resetFields();
      fetchTemplates();
    } catch (error) {
      message.error(getApiError(error, t.app.error));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/custom-templates/${id}`);
      message.success(t.app.success);
      fetchTemplates();
    } catch (error) {
      message.error(getApiError(error, t.app.error));
    }
  };

  const docTypeLabels = t.doc.types;

  const columns = [
    {
      title: t.app.name,
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: any) => (
        <Space>
          <SnippetsOutlined />
          <Space direction="vertical" size={0}>
            <Text strong>{name}</Text>
            {record.description && <Text type="secondary" style={{ fontSize: 12 }}>{record.description.slice(0, 50)}</Text>}
          </Space>
        </Space>
      ),
    },
    {
      title: t.doc.type,
      dataIndex: 'documentType',
      key: 'documentType',
      width: 200,
      render: (type: string) => type ? <Tag color="blue">{(docTypeLabels as any)[type] || type}</Tag> : '-',
    },
    {
      title: t.templates?.format || 'Format',
      dataIndex: 'format',
      key: 'format',
      width: 100,
      render: (format: string) => <Tag>{format || 'DOCX'}</Tag>,
    },
    {
      title: t.templates?.version || 'Version',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      render: (v: number) => `v${v}`,
    },
    {
      title: t.templates?.usageCount || 'Usage',
      key: 'usage',
      width: 80,
      render: (_: any, record: any) => <Badge count={record._count?.documents || 0} showZero style={{ backgroundColor: '#52c41a' }} />,
    },
    {
      title: t.templates?.createdBy || 'Created By',
      key: 'createdBy',
      width: 150,
      render: (_: any, record: any) => record.createdBy?.fio || '-',
    },
    {
      title: t.app.status,
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (isActive: boolean) => isActive ? <Tag color="green">{t.app.yes}</Tag> : <Tag color="red">{t.app.no}</Tag>,
    },
    {
      title: t.app.actions,
      key: 'actions',
      width: 140,
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => fetchDetail(record.id)} />
          <Button size="small" icon={<EditOutlined />} onClick={() => {
            setEditTemplate(record);
            form.setFieldsValue({
              name: record.name,
              description: record.description,
              documentType: record.documentType,
              format: record.format,
              isActive: record.isActive,
            });
            setModalVisible(true);
          }} />
          <Popconfirm title={t.app.confirm} onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title={<Space><SnippetsOutlined /> {t.templates?.title || 'Custom Templates'}</Space>}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditTemplate(null); setFileList([]); form.resetFields(); setModalVisible(true); }}>
            {t.templates?.addTemplate || 'Add Template'}
          </Button>
        }
      >
        <Table columns={columns} dataSource={templates} rowKey="id" loading={loading} pagination={false} />
      </Card>

      {/* Add/Edit Template Modal */}
      <Modal
        title={editTemplate ? (t.templates?.editTemplate || 'Edit Template') : (t.templates?.addTemplate || 'Add Template')}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setEditTemplate(null); setFileList([]); form.resetFields(); }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label={t.app.name} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t.app.description}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="documentType" label={t.doc.type}>
            <Select allowClear options={Object.entries(docTypeLabels).map(([k, v]) => ({ value: k, label: v }))} />
          </Form.Item>
          <Form.Item name="format" label={t.templates?.format || 'Format'} initialValue="DOCX">
            <Select options={[
              { value: 'DOCX', label: 'DOCX (Word)' },
              { value: 'XLSX', label: 'XLSX (Excel)' },
              { value: 'PDF', label: 'PDF' },
            ]} />
          </Form.Item>
          {!editTemplate && (
            <Form.Item
              label={t.templates?.file || 'Шаблон файлы'}
              rules={[{ required: true, message: t.templates?.fileRequired || 'Dosya seçiniz / Выберите файл' }]}
            >
              <Upload.Dragger
                fileList={fileList}
                beforeUpload={(file) => {
                  setFileList([file as unknown as UploadFile]);
                  return false; // prevent auto upload
                }}
                onRemove={() => setFileList([])}
                maxCount={1}
                accept=".docx,.xlsx,.pdf"
              >
                <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                <p className="ant-upload-text">{t.templates?.dragFile || 'Dosyayı buraya sürükleyin veya tıklayın'}</p>
                <p className="ant-upload-hint">DOCX, XLSX, PDF (max 50MB)</p>
              </Upload.Dragger>
            </Form.Item>
          )}
          {editTemplate && (
            <Form.Item name="isActive" label={t.app.status} valuePropName="checked">
              <Switch checkedChildren={t.app.yes} unCheckedChildren={t.app.no} />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        title={selectedTemplate?.name}
        open={detailVisible}
        onCancel={() => { setDetailVisible(false); setSelectedTemplate(null); }}
        footer={null}
        width={600}
      >
        {selectedTemplate && (
          <div>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label={t.app.name}>{selectedTemplate.name}</Descriptions.Item>
              <Descriptions.Item label={t.templates?.format || 'Format'}>{selectedTemplate.format}</Descriptions.Item>
              <Descriptions.Item label={t.doc.type}>{selectedTemplate.documentType ? (docTypeLabels as any)[selectedTemplate.documentType] : '-'}</Descriptions.Item>
              <Descriptions.Item label={t.templates?.version || 'Version'}>v{selectedTemplate.version}</Descriptions.Item>
              <Descriptions.Item label={t.templates?.createdBy || 'Created By'}>{selectedTemplate.createdBy?.fio}</Descriptions.Item>
              <Descriptions.Item label={t.app.date}>{dayjs(selectedTemplate.createdAt).format('DD.MM.YYYY')}</Descriptions.Item>
              {selectedTemplate.fileName && (
                <Descriptions.Item label={t.templates?.file || 'Dosya'} span={2}>
                  <Space>
                    <FileTextOutlined />
                    {selectedTemplate.fileName}
                    {selectedTemplate.fileSize && (
                      <Tag>{(selectedTemplate.fileSize / 1024).toFixed(1)} KB</Tag>
                    )}
                  </Space>
                </Descriptions.Item>
              )}
            </Descriptions>
            {selectedTemplate.description && (
              <p style={{ marginTop: 16 }}><strong>{t.app.description}:</strong> {selectedTemplate.description}</p>
            )}
            {selectedTemplate.documents?.length > 0 && (
              <Card title={t.templates?.usedIn || 'Used In Documents'} size="small" style={{ marginTop: 16 }}>
                {selectedTemplate.documents.map((d: any) => (
                  <Tag key={d.id}>{d.title}</Tag>
                ))}
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CustomTemplates;

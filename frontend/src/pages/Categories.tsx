import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, Tag, Space,
  message, Popconfirm, Typography, Switch, Badge,
} from 'antd';
import {
  PlusOutlined, FolderOutlined, DeleteOutlined, EditOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import apiClient from '../api/client';
import { useI18n } from '../i18n';

const { Text } = Typography;

const Categories: React.FC = () => {
  const { id: projectId } = useParams();
  const { t } = useI18n();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editCategory, setEditCategory] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (projectId) fetchCategories();
  }, [projectId]);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/categories', { params: { projectId } });
      setCategories(res.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleSave = async (values: any) => {
    try {
      if (editCategory) {
        await apiClient.put(`/categories/${editCategory.id}`, values);
      } else {
        await apiClient.post('/categories', { ...values, projectId });
      }
      message.success(t.app.success);
      setModalVisible(false);
      setEditCategory(null);
      form.resetFields();
      fetchCategories();
    } catch (err: any) {
      message.error(err.response?.data?.error || t.app.error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/categories/${id}`);
      message.success(t.app.success);
      fetchCategories();
    } catch {
      message.error(t.app.error);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await apiClient.put(`/categories/${id}`, { isActive: !isActive });
      fetchCategories();
    } catch { /* ignore */ }
  };

  const columns = [
    {
      title: t.categories?.code || 'Code',
      dataIndex: 'code',
      key: 'code',
      width: 120,
      render: (code: string) => <Tag color="blue">{code}</Tag>,
    },
    {
      title: t.app.name,
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: any) => (
        <Space>
          <FolderOutlined />
          <Text strong>{name}</Text>
          {record._count?.documents > 0 && <Badge count={record._count.documents} style={{ backgroundColor: '#52c41a' }} />}
        </Space>
      ),
    },
    {
      title: t.app.description,
      dataIndex: 'description',
      key: 'description',
      render: (desc: string) => desc || '-',
    },
    {
      title: t.categories?.children || 'Sub-categories',
      key: 'children',
      width: 120,
      render: (_: any, record: any) => record.children?.length || 0,
    },
    {
      title: t.app.status,
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive: boolean, record: any) => (
        <Switch checked={isActive} onChange={() => handleToggleActive(record.id, isActive)} />
      ),
    },
    {
      title: t.app.actions,
      key: 'actions',
      width: 120,
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => {
            setEditCategory(record);
            form.setFieldsValue({
              code: record.code,
              name: record.name,
              description: record.description,
              parentId: record.parentId,
              sortOrder: record.sortOrder,
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
    <Card
      title={<Space><AppstoreOutlined /> {t.categories?.title || 'Document Categories'}</Space>}
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditCategory(null); form.resetFields(); setModalVisible(true); }}>
          {t.categories?.addCategory || 'Add Category'}
        </Button>
      }
    >
      <Table columns={columns} dataSource={categories} rowKey="id" loading={loading} pagination={false} />

      <Modal
        title={editCategory ? (t.categories?.editCategory || 'Edit Category') : (t.categories?.addCategory || 'Add Category')}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setEditCategory(null); form.resetFields(); }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="code" label={t.categories?.code || 'Code'} rules={[{ required: true }]}>
            <Input placeholder="e.g., CUSTOM-01" />
          </Form.Item>
          <Form.Item name="name" label={t.app.name} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t.app.description}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="parentId" label={t.categories?.parent || 'Parent Category'}>
            <Select allowClear>
              {categories.filter(c => c.id !== editCategory?.id).map((c: any) => (
                <Select.Option key={c.id} value={c.id}>{c.code} — {c.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="sortOrder" label={t.categories?.sortOrder || 'Sort Order'} initialValue={0}>
            <Input type="number" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default Categories;

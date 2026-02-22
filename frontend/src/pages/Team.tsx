import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, Tag, Space,
  message, Popconfirm, Typography, Switch, Tabs, Row, Col, Avatar,
  Descriptions,
} from 'antd';
import {
  PlusOutlined, UserAddOutlined, UserOutlined, DeleteOutlined,
  EditOutlined, TeamOutlined, MailOutlined, PhoneOutlined,
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import apiClient, { getApiError } from '../api/client';
import { useI18n } from '../i18n';

const { Text, Title } = Typography;

const Team: React.FC = () => {
  const { id: projectId } = useParams();
  const { t } = useI18n();
  const [members, setMembers] = useState<any[]>([]);
  const [availablePersons, setAvailablePersons] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [addExistingVisible, setAddExistingVisible] = useState(false);
  const [createNewVisible, setCreateNewVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editMember, setEditMember] = useState<any>(null);
  const [addForm] = Form.useForm();
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  useEffect(() => {
    if (projectId) {
      fetchMembers();
      fetchOrganizations();
    }
  }, [projectId]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/team', { params: { projectId } });
      setMembers(res.data || []);
    } catch (error) {
      message.error(getApiError(error, t.app.error));
    }
    setLoading(false);
  };

  const fetchAvailable = async () => {
    try {
      const res = await apiClient.get('/team/available', { params: { projectId } });
      setAvailablePersons(res.data || []);
    } catch (error) {
      message.error(getApiError(error, t.app.error));
    }
  };

  const fetchOrganizations = async () => {
    try {
      const res = await apiClient.get('/organizations');
      setOrganizations(res.data?.data || res.data || []);
    } catch (error) {
      message.error(getApiError(error, t.app.error));
    }
  };

  const handleAddExisting = async (values: any) => {
    try {
      await apiClient.post('/team/add-member', {
        projectId,
        personId: values.personId,
        projectRole: values.projectRole,
        canSign: values.canSign || false,
      });
      message.success(t.app.success);
      setAddExistingVisible(false);
      addForm.resetFields();
      fetchMembers();
    } catch (error: unknown) {
      const msg = getApiError(error, t.app.error);
      if (msg) message.error(msg);
    }
  };

  const handleCreateNew = async (values: any) => {
    try {
      await apiClient.post('/team/create-and-add', {
        projectId,
        fio: values.fio,
        email: values.email,
        position: values.position,
        role: values.role,
        phone: values.phone,
        projectRole: values.projectRole,
        canSign: values.canSign || false,
        organizationId: values.organizationId,
        password: values.password,
      });
      message.success(t.app.success);
      setCreateNewVisible(false);
      createForm.resetFields();
      fetchMembers();
    } catch (error: unknown) {
      const msg = getApiError(error, t.app.error);
      if (msg) message.error(msg);
    }
  };

  const handleUpdateMember = async (values: any) => {
    if (!editMember) return;
    try {
      await apiClient.put(`/team/${editMember.id}`, {
        projectRole: values.projectRole,
        canSign: values.canSign,
      });
      message.success(t.app.success);
      setEditVisible(false);
      setEditMember(null);
      editForm.resetFields();
      fetchMembers();
    } catch (error) {
      message.error(getApiError(error, t.app.error));
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await apiClient.delete(`/team/${memberId}`);
      message.success(t.app.success);
      fetchMembers();
    } catch (error) {
      message.error(getApiError(error, t.app.error));
    }
  };

  const projectRoleLabels = t.person.projectRoles;
  const userRoleLabels = t.person.roles;

  const roleColors: Record<string, string> = {
    RESPONSIBLE_PRODUCER: 'blue', SITE_CHIEF: 'green', QA_ENGINEER: 'cyan',
    TECH_SUPERVISOR_REP: 'orange', AUTHOR_SUPERVISOR_REP: 'purple',
    HSE_RESPONSIBLE: 'red', OTHER: 'default',
  };

  const columns = [
    {
      title: t.person.fio,
      key: 'fio',
      render: (_: any, record: any) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1677ff' }}>{record.person?.fio?.[0]}</Avatar>
          <Space direction="vertical" size={0}>
            <Text strong>{record.person?.fio}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{record.person?.position}</Text>
          </Space>
        </Space>
      ),
    },
    {
      title: t.person.email,
      key: 'email',
      width: 200,
      render: (_: any, record: any) => (
        <Space direction="vertical" size={0}>
          <Text><MailOutlined /> {record.person?.email}</Text>
          {record.person?.phone && <Text type="secondary"><PhoneOutlined /> {record.person?.phone}</Text>}
        </Space>
      ),
    },
    {
      title: t.person.organization,
      key: 'organization',
      width: 180,
      render: (_: any, record: any) => record.person?.organization?.shortName || record.person?.organization?.name || '-',
    },
    {
      title: t.team?.projectRole || 'Project Role',
      dataIndex: 'projectRole',
      key: 'projectRole',
      width: 200,
      render: (role: string) => <Tag color={roleColors[role]}>{(projectRoleLabels as any)[role] || role}</Tag>,
    },
    {
      title: t.team?.systemRole || 'System Role',
      key: 'systemRole',
      width: 150,
      render: (_: any, record: any) => <Tag>{(userRoleLabels as any)[record.person?.role] || record.person?.role}</Tag>,
    },
    {
      title: t.team?.canSign || 'Can Sign',
      dataIndex: 'canSign',
      key: 'canSign',
      width: 100,
      render: (canSign: boolean) => canSign ? <Tag color="green">{t.app.yes}</Tag> : <Tag>{t.app.no}</Tag>,
    },
    {
      title: t.app.actions,
      key: 'actions',
      width: 120,
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => {
            setEditMember(record);
            editForm.setFieldsValue({
              projectRole: record.projectRole,
              canSign: record.canSign,
            });
            setEditVisible(true);
          }} />
          <Popconfirm title={t.app.confirm} onConfirm={() => handleRemoveMember(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title={<Space><TeamOutlined /> {t.team?.title || 'Team Management'}</Space>}
        extra={
          <Space>
            <Button icon={<PlusOutlined />} onClick={() => { fetchAvailable(); setAddExistingVisible(true); }}>
              {t.team?.addExisting || 'Add Existing User'}
            </Button>
            <Button type="primary" icon={<UserAddOutlined />} onClick={() => setCreateNewVisible(true)}>
              {t.team?.createNew || 'Create New User'}
            </Button>
          </Space>
        }
      >
        <Table columns={columns} dataSource={members} rowKey="id" loading={loading} pagination={false} />
      </Card>

      {/* Add Existing User Modal */}
      <Modal
        title={t.team?.addExisting || 'Add Existing User to Project'}
        open={addExistingVisible}
        onCancel={() => { setAddExistingVisible(false); addForm.resetFields(); }}
        onOk={() => addForm.submit()}
      >
        <Form form={addForm} layout="vertical" onFinish={handleAddExisting}>
          <Form.Item name="personId" label={t.team?.selectUser || 'Select User'} rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label">
              {availablePersons.map((p: any) => (
                <Select.Option key={p.id} value={p.id} label={p.fio}>
                  {p.fio} — {p.position || p.role} {p.organization ? `(${p.organization.shortName || p.organization.name})` : ''}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="projectRole" label={t.team?.projectRole || 'Project Role'} rules={[{ required: true }]}>
            <Select options={Object.entries(projectRoleLabels).map(([k, v]) => ({ value: k, label: v }))} />
          </Form.Item>
          <Form.Item name="canSign" label={t.team?.canSign || 'Can Sign Documents'} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Create New User Modal */}
      <Modal
        title={t.team?.createNew || 'Create New User'}
        open={createNewVisible}
        onCancel={() => { setCreateNewVisible(false); createForm.resetFields(); }}
        onOk={() => createForm.submit()}
        width={700}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateNew}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="fio" label={t.person.fio} rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label={t.person.email} rules={[{ required: true, type: 'email' }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="position" label={t.person.position}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label={t.person.phone}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="role" label={t.team?.systemRole || 'System Role'} initialValue="ENGINEER">
                <Select options={Object.entries(userRoleLabels).map(([k, v]) => ({ value: k, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="organizationId" label={t.person.organization}>
                <Select allowClear>
                  {organizations.map((o: any) => (
                    <Select.Option key={o.id} value={o.id}>{o.shortName || o.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="projectRole" label={t.team?.projectRole || 'Project Role'} rules={[{ required: true }]}>
                <Select options={Object.entries(projectRoleLabels).map(([k, v]) => ({ value: k, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="password" label={t.auth.password} initialValue="Temp1234!">
                <Input.Password />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="canSign" label={t.team?.canSign || 'Can Sign Documents'} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Member Role Modal */}
      <Modal
        title={t.team?.editRole || 'Edit Member Role'}
        open={editVisible}
        onCancel={() => { setEditVisible(false); setEditMember(null); editForm.resetFields(); }}
        onOk={() => editForm.submit()}
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdateMember}>
          {editMember && (
            <Descriptions size="small" column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label={t.person.fio}>{editMember.person?.fio}</Descriptions.Item>
              <Descriptions.Item label={t.person.email}>{editMember.person?.email}</Descriptions.Item>
            </Descriptions>
          )}
          <Form.Item name="projectRole" label={t.team?.projectRole || 'Project Role'} rules={[{ required: true }]}>
            <Select options={Object.entries(projectRoleLabels).map(([k, v]) => ({ value: k, label: v }))} />
          </Form.Item>
          <Form.Item name="canSign" label={t.team?.canSign || 'Can Sign Documents'} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Team;

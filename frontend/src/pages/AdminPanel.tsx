import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, Tag, Space,
  message, Popconfirm, Typography, Checkbox, Row, Col, Divider,
  Tooltip, Grid, Badge,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, SafetyOutlined,
  UserOutlined, CrownOutlined, ReloadOutlined, SaveOutlined,
} from '@ant-design/icons';
import apiClient, { getApiError } from '../api/client';
import { useI18n } from '../i18n';
import type { AdminUser, UserRole, PermissionModule, UserPermissions } from '../types';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const PERMISSION_MODULES: PermissionModule[] = [
  'dashboard', 'documents', 'materials', 'journals', 'tasks',
  'corrections', 'packages', 'templates', 'categories', 'team',
  'matrix', 'progress', 'admin',
];

const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete'] as const;

const USER_ROLES: UserRole[] = [
  'ADMIN', 'PROJECT_MANAGER', 'SITE_MANAGER', 'ENGINEER',
  'TECH_SUPERVISOR', 'AUTHOR_SUPERVISOR', 'LAB_TECHNICIAN',
  'SUPPLIER', 'HSE_OFFICER',
];

const AdminPanel: React.FC = () => {
  const { t } = useI18n();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [permModalOpen, setPermModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [editingPerms, setEditingPerms] = useState<UserPermissions | null>(null);
  const [savingPerms, setSavingPerms] = useState(false);
  const [form] = Form.useForm();

  const adminT = (t as any).admin || {};
  const moduleLabels = adminT.modules || {};
  const actionLabels = adminT.actions || {};
  const roleLabels = t.person.roles;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/users');
      setUsers(res.data || []);
    } catch (error) {
      message.error(getApiError(error, t.app.error));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // --- User CRUD ---
  const handleCreateUser = async (values: any) => {
    try {
      await apiClient.post('/admin/users', values);
      message.success(t.app.success);
      setCreateModalOpen(false);
      form.resetFields();
      fetchUsers();
    } catch (error) {
      message.error(getApiError(error, t.app.error));
    }
  };

  const handleRoleChange = async (userId: string, role: UserRole) => {
    try {
      await apiClient.put(`/admin/users/${userId}`, { role });
      message.success(t.app.success);
      fetchUsers();
    } catch (error) {
      message.error(getApiError(error, t.app.error));
    }
  };

  const handlePositionChange = async (userId: string, position: string) => {
    try {
      await apiClient.put(`/admin/users/${userId}`, { position });
    } catch (error) {
      message.error(getApiError(error, t.app.error));
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await apiClient.delete(`/admin/users/${userId}`);
      message.success(t.app.success);
      fetchUsers();
    } catch (error) {
      message.error(getApiError(error, t.app.error));
    }
  };

  // --- Permissions ---
  const openPermissions = (user: AdminUser) => {
    setSelectedUser(user);
    setEditingPerms(JSON.parse(JSON.stringify(user.permissions)));
    setPermModalOpen(true);
  };

  const togglePermission = (module: PermissionModule, action: typeof PERMISSION_ACTIONS[number]) => {
    if (!editingPerms) return;
    const updated = { ...editingPerms };
    if (!updated[module]) {
      updated[module] = { view: false, create: false, edit: false, delete: false };
    }
    updated[module] = { ...updated[module], [action]: !updated[module][action] };
    // If turning off view, turn off everything for that module
    if (action === 'view' && !updated[module].view) {
      updated[module] = { view: false, create: false, edit: false, delete: false };
    }
    // If turning on create/edit/delete, ensure view is on
    if (action !== 'view' && updated[module][action]) {
      updated[module].view = true;
    }
    setEditingPerms(updated);
  };

  const savePermissions = async () => {
    if (!selectedUser || !editingPerms) return;
    setSavingPerms(true);
    try {
      await apiClient.put(`/admin/users/${selectedUser.id}`, { permissions: editingPerms });
      message.success(adminT.permissionsSaved || 'Permissions saved');
      setPermModalOpen(false);
      fetchUsers();
    } catch (error) {
      message.error(getApiError(error, t.app.error));
    }
    setSavingPerms(false);
  };

  const resetToDefaults = async () => {
    if (!selectedUser) return;
    try {
      const res = await apiClient.get(`/admin/default-permissions/${selectedUser.role}`);
      setEditingPerms(res.data);
    } catch (error) {
      message.error(getApiError(error, t.app.error));
    }
  };

  // Role color mapping
  const roleColor = (role: string) => {
    const colors: Record<string, string> = {
      ADMIN: 'red',
      PROJECT_MANAGER: 'blue',
      SITE_MANAGER: 'green',
      ENGINEER: 'cyan',
      TECH_SUPERVISOR: 'purple',
      AUTHOR_SUPERVISOR: 'magenta',
      LAB_TECHNICIAN: 'orange',
      SUPPLIER: 'gold',
      HSE_OFFICER: 'lime',
    };
    return colors[role] || 'default';
  };

  const columns = [
    {
      title: <><UserOutlined /> {adminT.users || 'Users'}</>,
      key: 'user',
      render: (_: any, record: AdminUser) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.fio}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.email}</Text>
        </Space>
      ),
    },
    {
      title: adminT.position || t.person.position,
      dataIndex: 'position',
      key: 'position',
      width: 180,
      responsive: ['md' as const],
      render: (pos: string, record: AdminUser) => (
        <Input
          size="small"
          defaultValue={pos || ''}
          placeholder={adminT.position || t.person.position}
          onBlur={(e) => {
            if (e.target.value !== (pos || '')) {
              handlePositionChange(record.id, e.target.value);
            }
          }}
          onPressEnter={(e) => (e.target as HTMLInputElement).blur()}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: adminT.userRole || t.person.role,
      key: 'role',
      width: 180,
      render: (_: any, record: AdminUser) => (
        <Select
          size="small"
          value={record.role}
          onChange={(val) => handleRoleChange(record.id, val)}
          style={{ width: '100%' }}
          options={USER_ROLES.map((r) => ({
            value: r,
            label: (
              <Space>
                {r === 'ADMIN' && <CrownOutlined style={{ color: '#ff4d4f' }} />}
                {(roleLabels as any)[r] || r}
              </Space>
            ),
          }))}
        />
      ),
    },
    {
      title: adminT.organization || t.person.organization,
      key: 'org',
      width: 150,
      responsive: ['lg' as const],
      render: (_: any, record: AdminUser) => record.organization?.shortName || record.organization?.name || '-',
    },
    {
      title: adminT.projects || 'Projects',
      key: 'projects',
      width: 80,
      align: 'center' as const,
      responsive: ['md' as const],
      render: (_: any, record: AdminUser) => (
        <Badge count={record._count?.projectMembers || 0} showZero style={{ backgroundColor: '#52c41a' }} />
      ),
    },
    {
      title: t.app.actions,
      key: 'actions',
      width: isMobile ? 100 : 140,
      render: (_: any, record: AdminUser) => (
        <Space wrap size="small">
          <Tooltip title={adminT.editPermissions || 'Permissions'}>
            <Button
              size="small"
              type="primary"
              ghost
              icon={<SafetyOutlined />}
              onClick={() => openPermissions(record)}
            />
          </Tooltip>
          <Popconfirm
            title={t.app.confirm}
            onConfirm={() => handleDeleteUser(record.id)}
          >
            <Tooltip title={adminT.deleteUser || 'Delete'}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title={
          <Space>
            <CrownOutlined style={{ color: '#ff4d4f' }} />
            <span>{adminT.title || 'Admin Panel'}</span>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              setCreateModalOpen(true);
            }}
          >
            {!isMobile && (adminT.createUser || 'Create User')}
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={users.length > 20 ? { pageSize: 20, showSizeChanger: false } : false}
          scroll={{ x: 600 }}
          size="small"
        />
      </Card>

      {/* Create User Modal */}
      <Modal
        title={adminT.createUser || 'Create User'}
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        width="95%"
        style={{ maxWidth: 600 }}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateUser}>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="fio" label={t.person.fio} rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="email" label={adminT.email || 'Email'} rules={[{ required: true, type: 'email' }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="password" label={adminT.password || 'Password'}>
                <Input.Password placeholder="Temp1234!" />
              </Form.Item>
              <Text type="secondary" style={{ fontSize: 12 }}>{adminT.defaultPassword || 'Default: Temp1234!'}</Text>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="role" label={adminT.userRole || 'Role'} initialValue="ENGINEER">
                <Select
                  options={USER_ROLES.map((r) => ({
                    value: r,
                    label: (roleLabels as any)[r] || r,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="position" label={adminT.position || 'Position'}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="phone" label={adminT.phone || 'Phone'}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Permissions Modal */}
      <Modal
        title={
          <Space>
            <SafetyOutlined />
            <span>{adminT.editPermissions || 'Edit Permissions'}</span>
            {selectedUser && <Tag color={roleColor(selectedUser.role)}>{(roleLabels as any)[selectedUser.role]}</Tag>}
          </Space>
        }
        open={permModalOpen}
        onCancel={() => { setPermModalOpen(false); setSelectedUser(null); setEditingPerms(null); }}
        width="95%"
        style={{ maxWidth: 750 }}
        footer={[
          <Button key="reset" icon={<ReloadOutlined />} onClick={resetToDefaults}>
            {adminT.resetToDefaults || 'Reset to Defaults'}
          </Button>,
          <Button key="cancel" onClick={() => setPermModalOpen(false)}>
            {t.app.cancel}
          </Button>,
          <Button key="save" type="primary" icon={<SaveOutlined />} loading={savingPerms} onClick={savePermissions}>
            {t.app.save}
          </Button>,
        ]}
      >
        {selectedUser && editingPerms && (
          <div>
            <Space style={{ marginBottom: 16 }}>
              <UserOutlined />
              <Text strong>{selectedUser.fio}</Text>
              <Text type="secondary">({selectedUser.email})</Text>
            </Space>
            <Divider style={{ margin: '8px 0' }} />

            {/* Permission Grid */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid #f0f0f0', minWidth: 140 }}>
                      {adminT.modules?.dashboard ? '' : 'Module'}
                    </th>
                    {PERMISSION_ACTIONS.map((action) => (
                      <th key={action} style={{ textAlign: 'center', padding: '8px 6px', borderBottom: '2px solid #f0f0f0', minWidth: 70 }}>
                        {actionLabels[action] || action}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_MODULES.map((mod) => {
                    const perms = editingPerms[mod] || { view: false, create: false, edit: false, delete: false };
                    return (
                      <tr key={mod} style={{ borderBottom: '1px solid #f5f5f5' }}>
                        <td style={{ padding: '6px 12px', fontWeight: 500 }}>
                          {moduleLabels[mod] || mod}
                        </td>
                        {PERMISSION_ACTIONS.map((action) => (
                          <td key={action} style={{ textAlign: 'center', padding: '6px' }}>
                            <Checkbox
                              checked={perms[action]}
                              onChange={() => togglePermission(mod, action)}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminPanel;

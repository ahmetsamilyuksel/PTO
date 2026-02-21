import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, DatePicker, Tag, Space,
  Badge, Tabs, message, Popconfirm, Typography, Row, Col, Statistic, Tooltip,
  Progress, Alert,
} from 'antd';
import {
  PlusOutlined, CheckCircleOutlined, ClockCircleOutlined,
  ExclamationCircleOutlined, BellOutlined, UserOutlined,
  DeleteOutlined, EditOutlined, EyeOutlined, CalendarOutlined,
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import apiClient from '../api/client';
import { useI18n } from '../i18n';

const { TextArea } = Input;
const { Text, Title } = Typography;

const Tasks: React.FC = () => {
  const { id: projectId } = useParams();
  const { t } = useI18n();
  const [tasks, setTasks] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any>({ overdue: [], upcoming: [], total: 0 });
  const [members, setMembers] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [form] = Form.useForm();
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (projectId) {
      fetchTasks();
      fetchReminders();
      fetchMembers();
      fetchDocuments();
    }
  }, [projectId, filterStatus, page]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params: any = { projectId, page, pageSize: 20 };
      if (filterStatus) params.status = filterStatus;
      const res = await apiClient.get('/tasks', { params });
      setTasks(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const fetchReminders = async () => {
    try {
      const res = await apiClient.get('/tasks/reminders', { params: { projectId } });
      setReminders(res.data);
    } catch { /* ignore */ }
  };

  const fetchMembers = async () => {
    try {
      const res = await apiClient.get('/team', { params: { projectId } });
      setMembers(res.data || []);
    } catch { /* ignore */ }
  };

  const fetchDocuments = async () => {
    try {
      const res = await apiClient.get('/documents', { params: { projectId, pageSize: 100 } });
      setDocuments(res.data.data || res.data || []);
    } catch { /* ignore */ }
  };

  const handleCreate = async (values: any) => {
    try {
      await apiClient.post('/tasks', {
        projectId,
        title: values.title,
        description: values.description,
        priority: values.priority,
        dueDate: values.dueDate?.toISOString(),
        reminderDate: values.reminderDate?.toISOString(),
        relatedDocId: values.relatedDocId,
        assigneeIds: values.assigneeIds,
        notes: values.notes,
      });
      message.success(t.app.success);
      setModalVisible(false);
      form.resetFields();
      fetchTasks();
      fetchReminders();
    } catch {
      message.error(t.app.error);
    }
  };

  const handleStatusChange = async (taskId: string, status: string) => {
    try {
      await apiClient.put(`/tasks/${taskId}`, { status });
      message.success(t.app.success);
      fetchTasks();
      fetchReminders();
    } catch {
      message.error(t.app.error);
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await apiClient.delete(`/tasks/${taskId}`);
      message.success(t.app.success);
      fetchTasks();
    } catch {
      message.error(t.app.error);
    }
  };

  const priorityColors: Record<string, string> = {
    LOW: 'default',
    MEDIUM: 'blue',
    HIGH: 'orange',
    URGENT: 'red',
  };

  const priorityLabels: Record<string, string> = {
    LOW: t.tasks?.priorities?.LOW || 'Low',
    MEDIUM: t.tasks?.priorities?.MEDIUM || 'Medium',
    HIGH: t.tasks?.priorities?.HIGH || 'High',
    URGENT: t.tasks?.priorities?.URGENT || 'Urgent',
  };

  const statusColors: Record<string, string> = {
    PENDING: 'default',
    IN_PROGRESS: 'processing',
    COMPLETED: 'success',
    CANCELLED: 'error',
    OVERDUE: 'warning',
  };

  const statusLabels: Record<string, string> = {
    PENDING: t.tasks?.statuses?.PENDING || 'Pending',
    IN_PROGRESS: t.tasks?.statuses?.IN_PROGRESS || 'In Progress',
    COMPLETED: t.tasks?.statuses?.COMPLETED || 'Completed',
    CANCELLED: t.tasks?.statuses?.CANCELLED || 'Cancelled',
    OVERDUE: t.tasks?.statuses?.OVERDUE || 'Overdue',
  };

  const columns = [
    {
      title: t.tasks?.title_col || 'Task',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          {record.description && <Text type="secondary" style={{ fontSize: 12 }}>{record.description.slice(0, 60)}</Text>}
        </Space>
      ),
    },
    {
      title: t.tasks?.priority || 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority: string) => (
        <Tag color={priorityColors[priority]}>{priorityLabels[priority]}</Tag>
      ),
    },
    {
      title: t.app.status,
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => (
        <Badge status={statusColors[status] as any} text={statusLabels[status]} />
      ),
    },
    {
      title: t.tasks?.assignees || 'Assignees',
      key: 'assignments',
      width: 200,
      render: (_: any, record: any) => (
        <Space wrap>
          {record.assignments?.map((a: any) => (
            <Tag key={a.id} icon={<UserOutlined />}>{a.assignee?.fio}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: t.tasks?.dueDate || 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 120,
      render: (date: string) => {
        if (!date) return '-';
        const d = dayjs(date);
        const isOverdue = d.isBefore(dayjs()) ;
        return <Text type={isOverdue ? 'danger' : undefined}>{d.format('DD.MM.YYYY')}</Text>;
      },
    },
    {
      title: t.app.actions,
      key: 'actions',
      width: 180,
      render: (_: any, record: any) => (
        <Space>
          <Tooltip title={t.app.edit}>
            <Button size="small" icon={<EyeOutlined />} onClick={() => { setSelectedTask(record); setDetailVisible(true); }} />
          </Tooltip>
          {record.status !== 'COMPLETED' && (
            <Tooltip title={t.tasks?.complete || 'Complete'}>
              <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                onClick={() => handleStatusChange(record.id, 'COMPLETED')} />
            </Tooltip>
          )}
          <Popconfirm title={t.app.confirm} onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const pendingCount = tasks.filter(t => t.status === 'PENDING').length;
  const inProgressCount = tasks.filter(t => t.status === 'IN_PROGRESS').length;
  const completedCount = tasks.filter(t => t.status === 'COMPLETED').length;

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title={t.tasks?.totalTasks || 'Total Tasks'} value={total} prefix={<CalendarOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title={t.tasks?.statuses?.PENDING || 'Pending'} value={pendingCount} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title={t.tasks?.statuses?.IN_PROGRESS || 'In Progress'} value={inProgressCount} prefix={<ExclamationCircleOutlined />} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title={t.tasks?.statuses?.COMPLETED || 'Completed'} value={completedCount} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      {reminders.overdue?.length > 0 && (
        <Alert
          type="error"
          showIcon
          icon={<BellOutlined />}
          message={`${t.tasks?.overdueAlert || 'Overdue tasks'}: ${reminders.overdue.length}`}
          style={{ marginBottom: 16 }}
        />
      )}
      {reminders.upcoming?.length > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<BellOutlined />}
          message={`${t.tasks?.upcomingAlert || 'Upcoming deadlines'}: ${reminders.upcoming.length}`}
          style={{ marginBottom: 16 }}
        />
      )}

      <Card
        title={t.tasks?.title || 'Task Management'}
        extra={
          <Space>
            <Select
              placeholder={t.app.filter}
              allowClear
              style={{ width: 160 }}
              onChange={(v) => { setFilterStatus(v); setPage(1); }}
              options={Object.entries(statusLabels).map(([k, v]) => ({ value: k, label: v }))}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
              {t.tasks?.createTask || 'Create Task'}
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            total,
            pageSize: 20,
            onChange: setPage,
            showTotal: (t) => `${t} ${t.tasks?.items || 'items'}`,
          }}
        />
      </Card>

      {/* Create Task Modal */}
      <Modal
        title={t.tasks?.createTask || 'Create Task'}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        onOk={() => form.submit()}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="title" label={t.tasks?.taskName || 'Task Name'} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t.app.description}>
            <TextArea rows={3} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="priority" label={t.tasks?.priority || 'Priority'} initialValue="MEDIUM">
                <Select options={Object.entries(priorityLabels).map(([k, v]) => ({ value: k, label: v }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="dueDate" label={t.tasks?.dueDate || 'Due Date'}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="reminderDate" label={t.tasks?.reminderDate || 'Reminder'}>
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="assigneeIds" label={t.tasks?.assignees || 'Assignees'}>
            <Select mode="multiple" placeholder={t.tasks?.selectAssignees || 'Select assignees'}>
              {members.map((m: any) => (
                <Select.Option key={m.person?.id || m.personId} value={m.person?.id || m.personId}>
                  {m.person?.fio} — {m.person?.position || m.projectRole}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="relatedDocId" label={t.tasks?.relatedDoc || 'Related Document'}>
            <Select allowClear showSearch optionFilterProp="label"
              options={documents.map((d: any) => ({
                value: d.id,
                label: `${d.documentNumber || ''} ${d.title}`.trim(),
              }))}
            />
          </Form.Item>
          <Form.Item name="notes" label={t.tasks?.notes || 'Notes'}>
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Task Detail Modal */}
      <Modal
        title={selectedTask?.title}
        open={detailVisible}
        onCancel={() => { setDetailVisible(false); setSelectedTask(null); }}
        footer={[
          selectedTask?.status !== 'COMPLETED' && (
            <Button key="progress" onClick={() => handleStatusChange(selectedTask.id, 'IN_PROGRESS')}>
              {t.tasks?.markInProgress || 'Mark In Progress'}
            </Button>
          ),
          selectedTask?.status !== 'COMPLETED' && (
            <Button key="complete" type="primary" onClick={() => handleStatusChange(selectedTask.id, 'COMPLETED')}>
              {t.tasks?.complete || 'Complete'}
            </Button>
          ),
        ].filter(Boolean)}
        width={600}
      >
        {selectedTask && (
          <div>
            <p><strong>{t.app.description}:</strong> {selectedTask.description || '-'}</p>
            <p><strong>{t.tasks?.priority || 'Priority'}:</strong> <Tag color={priorityColors[selectedTask.priority]}>{priorityLabels[selectedTask.priority]}</Tag></p>
            <p><strong>{t.app.status}:</strong> <Badge status={statusColors[selectedTask.status] as any} text={statusLabels[selectedTask.status]} /></p>
            <p><strong>{t.tasks?.dueDate || 'Due Date'}:</strong> {selectedTask.dueDate ? dayjs(selectedTask.dueDate).format('DD.MM.YYYY') : '-'}</p>
            <p><strong>{t.tasks?.createdBy || 'Created By'}:</strong> {selectedTask.createdBy?.fio}</p>
            <p><strong>{t.tasks?.assignees || 'Assignees'}:</strong></p>
            <Space wrap>
              {selectedTask.assignments?.map((a: any) => (
                <Tag key={a.id} icon={<UserOutlined />}>{a.assignee?.fio} ({a.status})</Tag>
              ))}
            </Space>
            {selectedTask.relatedDoc && (
              <p style={{ marginTop: 8 }}><strong>{t.tasks?.relatedDoc || 'Related Document'}:</strong> {selectedTask.relatedDoc.title}</p>
            )}
            {selectedTask.notes && <p><strong>{t.tasks?.notes || 'Notes'}:</strong> {selectedTask.notes}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Tasks;

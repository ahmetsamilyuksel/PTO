import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, DatePicker, Tag, Space,
  Badge, message, Popconfirm, Typography, Row, Col, Statistic, Tooltip,
  Alert, Avatar, List, Divider, Timeline,
} from 'antd';
import {
  PlusOutlined, CheckCircleOutlined, ClockCircleOutlined,
  ExclamationCircleOutlined, BellOutlined, UserOutlined,
  DeleteOutlined, EyeOutlined, CalendarOutlined,
  SendOutlined, MessageOutlined, SyncOutlined,
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import apiClient, { getApiError } from '../api/client';
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
  const [taskMessages, setTaskMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
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
    } catch (error) {
      message.error(getApiError(error, t.app.error));
    }
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
      const res = await apiClient.get('/documents', { params: { projectId, limit: 100 } });
      setDocuments(res.data.data || res.data || []);
    } catch { /* ignore */ }
  };

  const fetchTaskMessages = async (taskId: string) => {
    try {
      const res = await apiClient.get(`/tasks/${taskId}/messages`);
      setTaskMessages(res.data.messages || []);
    } catch { setTaskMessages([]); }
  };

  const openTaskDetail = async (task: any) => {
    setSelectedTask(task);
    setDetailVisible(true);
    setNewMessage('');
    await fetchTaskMessages(task.id);
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
      });
      message.success(t.app.success);
      setModalVisible(false);
      form.resetFields();
      fetchTasks();
      fetchReminders();
    } catch (error) {
      const msg = getApiError(error, t.app.error);
      if (msg) message.error(msg);
    }
  };

  const handleStatusChange = async (taskId: string, status: string) => {
    try {
      await apiClient.put(`/tasks/${taskId}`, { status });
      message.success(t.app.success);
      fetchTasks();
      fetchReminders();
      // Refresh detail if open
      if (selectedTask?.id === taskId) {
        const res = await apiClient.get(`/tasks/${taskId}`);
        setSelectedTask(res.data);
      }
    } catch (error) {
      const msg = getApiError(error, t.app.error);
      if (msg) message.error(msg);
    }
  };

  const handleAssignmentStatusChange = async (taskId: string, assignmentId: string, status: string, comment?: string) => {
    try {
      await apiClient.put(`/tasks/${taskId}/assignments/${assignmentId}`, { status, comment });
      message.success(t.app.success);
      // Refresh task detail
      const res = await apiClient.get(`/tasks/${taskId}`);
      setSelectedTask(res.data);
      fetchTasks();
    } catch (error) {
      const msg = getApiError(error, t.app.error);
      if (msg) message.error(msg);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTask) return;
    setSendingMessage(true);
    try {
      const res = await apiClient.post(`/tasks/${selectedTask.id}/message`, { text: newMessage.trim() });
      setTaskMessages(res.data.messages || []);
      setNewMessage('');
    } catch (error) {
      const msg = getApiError(error, t.app.error);
      if (msg) message.error(msg);
    }
    setSendingMessage(false);
  };

  const handleDelete = async (taskId: string) => {
    try {
      await apiClient.delete(`/tasks/${taskId}`);
      message.success(t.app.success);
      fetchTasks();
    } catch (error) {
      const msg = getApiError(error, t.app.error);
      if (msg) message.error(msg);
    }
  };

  const priorityColors: Record<string, string> = {
    LOW: 'default', MEDIUM: 'blue', HIGH: 'orange', URGENT: 'red',
  };

  const priorityLabels: Record<string, string> = {
    LOW: t.tasks?.priorities?.LOW || 'Düşük',
    MEDIUM: t.tasks?.priorities?.MEDIUM || 'Orta',
    HIGH: t.tasks?.priorities?.HIGH || 'Yüksek',
    URGENT: t.tasks?.priorities?.URGENT || 'Acil',
  };

  const statusColors: Record<string, string> = {
    PENDING: 'default', IN_PROGRESS: 'processing', COMPLETED: 'success',
    CANCELLED: 'error', OVERDUE: 'warning',
  };

  const statusLabels: Record<string, string> = {
    PENDING: t.tasks?.statuses?.PENDING || 'Bekliyor',
    IN_PROGRESS: t.tasks?.statuses?.IN_PROGRESS || 'Devam Ediyor',
    COMPLETED: t.tasks?.statuses?.COMPLETED || 'Tamamlandı',
    CANCELLED: t.tasks?.statuses?.CANCELLED || 'İptal',
    OVERDUE: t.tasks?.statuses?.OVERDUE || 'Gecikmiş',
  };

  const assignmentStatusLabels: Record<string, string> = {
    PENDING: 'Atandı',
    ACCEPTED: 'Kabul Etti',
    IN_PROGRESS: 'Çalışıyor',
    COMPLETED: 'Tamamladı',
    REJECTED: 'Reddetti',
  };

  const assignmentStatusColors: Record<string, string> = {
    PENDING: 'default', ACCEPTED: 'blue', IN_PROGRESS: 'processing',
    COMPLETED: 'success', REJECTED: 'error',
  };

  // Get current user ID
  const currentUserId = (() => {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr).id : null;
    } catch { return null; }
  })();

  const columns = [
    {
      title: t.tasks?.title_col || 'Görev',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => openTaskDetail(record)}>{text}</Text>
          {record.description && <Text type="secondary" style={{ fontSize: 12 }}>{record.description.slice(0, 60)}</Text>}
        </Space>
      ),
    },
    {
      title: t.tasks?.priority || 'Öncelik',
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
      title: t.tasks?.assignees || 'Sorumlular',
      key: 'assignments',
      width: 250,
      render: (_: any, record: any) => (
        <Space wrap size={[4, 4]}>
          {record.assignments?.map((a: any) => (
            <Tooltip key={a.id} title={`${a.assignee?.fio} - ${assignmentStatusLabels[a.status] || a.status}`}>
              <Tag
                icon={<UserOutlined />}
                color={assignmentStatusColors[a.status]}
              >
                {a.assignee?.fio?.split(' ')[0]}
              </Tag>
            </Tooltip>
          ))}
          {(!record.assignments || record.assignments.length === 0) && (
            <Text type="secondary" style={{ fontSize: 12 }}>Atanmamış</Text>
          )}
        </Space>
      ),
    },
    {
      title: t.tasks?.dueDate || 'Son Tarih',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 120,
      render: (date: string) => {
        if (!date) return '-';
        const d = dayjs(date);
        const isOverdue = d.isBefore(dayjs());
        return <Text type={isOverdue ? 'danger' : undefined}>{d.format('DD.MM.YYYY')}</Text>;
      },
    },
    {
      title: t.app.actions,
      key: 'actions',
      width: 160,
      render: (_: any, record: any) => (
        <Space>
          <Tooltip title="Detay">
            <Button size="small" icon={<EyeOutlined />} onClick={() => openTaskDetail(record)} />
          </Tooltip>
          {record.status === 'PENDING' && (
            <Tooltip title={t.tasks?.markInProgress || 'İşleme Al'}>
              <Button size="small" icon={<SyncOutlined />}
                onClick={() => handleStatusChange(record.id, 'IN_PROGRESS')} />
            </Tooltip>
          )}
          {record.status !== 'COMPLETED' && (
            <Tooltip title={t.tasks?.complete || 'Tamamla'}>
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

  const pendingCount = tasks.filter(task => task.status === 'PENDING').length;
  const inProgressCount = tasks.filter(task => task.status === 'IN_PROGRESS').length;
  const completedCount = tasks.filter(task => task.status === 'COMPLETED').length;

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}>
          <Card><Statistic title={t.tasks?.totalTasks || 'Toplam Görev'} value={total} prefix={<CalendarOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card><Statistic title={t.tasks?.statuses?.PENDING || 'Bekliyor'} value={pendingCount} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#1677ff' }} /></Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card><Statistic title={t.tasks?.statuses?.IN_PROGRESS || 'Devam Ediyor'} value={inProgressCount} prefix={<ExclamationCircleOutlined />} valueStyle={{ color: '#faad14' }} /></Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card><Statistic title={t.tasks?.statuses?.COMPLETED || 'Tamamlandı'} value={completedCount} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
      </Row>

      {reminders.overdue?.length > 0 && (
        <Alert type="error" showIcon icon={<BellOutlined />}
          message={`${t.tasks?.overdueAlert || 'Gecikmiş görevler'}: ${reminders.overdue.length}`}
          style={{ marginBottom: 16 }} />
      )}
      {reminders.upcoming?.length > 0 && (
        <Alert type="warning" showIcon icon={<BellOutlined />}
          message={`${t.tasks?.upcomingAlert || 'Yaklaşan son tarihler'}: ${reminders.upcoming.length}`}
          style={{ marginBottom: 16 }} />
      )}

      <Card
        title={t.tasks?.title || 'Görev Yönetimi'}
        extra={
          <Space wrap>
            <Select placeholder={t.app.filter} allowClear style={{ minWidth: 140 }}
              onChange={(v) => { setFilterStatus(v); setPage(1); }}
              options={Object.entries(statusLabels).map(([k, v]) => ({ value: k, label: v }))}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
              {t.tasks?.createTask || 'Görev Oluştur'}
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          loading={loading}
          scroll={{ x: 800 }}
          pagination={{
            current: page,
            total,
            pageSize: 20,
            onChange: setPage,
            showTotal: (totalCount) => `${totalCount} ${t.tasks?.items || 'kayıt'}`,
          }}
        />
      </Card>

      {/* Create Task Modal */}
      <Modal
        title={t.tasks?.createTask || 'Görev Oluştur'}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        onOk={() => form.submit()}
        width="95%"
        style={{ maxWidth: 700 }}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="title" label={t.tasks?.taskName || 'Görev Adı'} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t.app.description}>
            <TextArea rows={3} />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="priority" label={t.tasks?.priority || 'Öncelik'} initialValue="MEDIUM">
                <Select options={Object.entries(priorityLabels).map(([k, v]) => ({ value: k, label: v }))} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={8}>
              <Form.Item name="dueDate" label={t.tasks?.dueDate || 'Son Tarih'}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={8}>
              <Form.Item name="reminderDate" label={t.tasks?.reminderDate || 'Hatırlatıcı'}>
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="assigneeIds"
            label={t.tasks?.assignees || 'Sorumlular'}
            rules={[{ required: true, message: t.messages.selectAtLeastOne }]}
          >
            <Select mode="multiple" placeholder={t.tasks?.selectAssignees || 'Sorumlu seçin'}
              optionFilterProp="label"
              options={members.map((m: any) => ({
                value: m.person?.id || m.personId,
                label: `${m.person?.fio} — ${m.person?.position || m.projectRole}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="relatedDocId" label={t.tasks?.relatedDoc || 'İlişkili Doküman'}>
            <Select allowClear showSearch optionFilterProp="label"
              options={documents.map((d: any) => ({
                value: d.id,
                label: `${d.documentNumber || ''} ${d.title}`.trim(),
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Task Detail Modal with Messages */}
      <Modal
        title={
          selectedTask && (
            <Space>
              <Tag color={priorityColors[selectedTask.priority]}>{priorityLabels[selectedTask.priority]}</Tag>
              {selectedTask.title}
            </Space>
          )
        }
        open={detailVisible}
        onCancel={() => { setDetailVisible(false); setSelectedTask(null); setTaskMessages([]); }}
        footer={null}
        width="95%"
        style={{ maxWidth: 750 }}
      >
        {selectedTask && (
          <div>
            {/* Task Info */}
            <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
              <Col xs={24} sm={12}>
                <Text type="secondary">{t.app.status}: </Text>
                <Badge status={statusColors[selectedTask.status] as any} text={statusLabels[selectedTask.status]} />
              </Col>
              <Col xs={24} sm={12}>
                <Text type="secondary">{t.tasks?.dueDate || 'Son Tarih'}: </Text>
                <Text type={selectedTask.dueDate && dayjs(selectedTask.dueDate).isBefore(dayjs()) ? 'danger' : undefined}>
                  {selectedTask.dueDate ? dayjs(selectedTask.dueDate).format('DD.MM.YYYY') : '-'}
                </Text>
              </Col>
            </Row>

            {selectedTask.description && (
              <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 8 }}>
                <Text>{selectedTask.description}</Text>
              </div>
            )}

            {selectedTask.relatedDoc && (
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary">{t.tasks?.relatedDoc || 'İlişkili Doküman'}: </Text>
                <Tag>{selectedTask.relatedDoc.documentNumber || selectedTask.relatedDoc.title}</Tag>
              </div>
            )}

            <div style={{ marginBottom: 8 }}>
              <Text type="secondary">{t.tasks?.createdBy || 'Oluşturan'}: </Text>
              <Text>{selectedTask.createdBy?.fio}</Text>
              <Text type="secondary"> — {dayjs(selectedTask.createdAt).format('DD.MM.YYYY HH:mm')}</Text>
            </div>

            {/* Task Status Actions */}
            {selectedTask.status !== 'COMPLETED' && (
              <Space style={{ marginBottom: 16 }}>
                {selectedTask.status === 'PENDING' && (
                  <Button icon={<SyncOutlined />} onClick={() => handleStatusChange(selectedTask.id, 'IN_PROGRESS')}>
                    {t.tasks?.markInProgress || 'İşleme Al'}
                  </Button>
                )}
                <Button type="primary" icon={<CheckCircleOutlined />}
                  onClick={() => handleStatusChange(selectedTask.id, 'COMPLETED')}>
                  {t.tasks?.complete || 'Tamamla'}
                </Button>
              </Space>
            )}

            <Divider orientation="left">{t.tasks?.assignees || 'Sorumlular'}</Divider>

            {/* Assignments with individual status/response */}
            <List
              dataSource={selectedTask.assignments || []}
              renderItem={(assignment: any) => {
                const isCurrentUser = assignment.assignee?.id === currentUserId || assignment.assigneeId === currentUserId;
                return (
                  <List.Item
                    actions={isCurrentUser && assignment.status !== 'COMPLETED' ? [
                      assignment.status === 'PENDING' && (
                        <Button key="accept" size="small" type="primary"
                          onClick={() => handleAssignmentStatusChange(selectedTask.id, assignment.id, 'IN_PROGRESS')}>
                          Kabul Et
                        </Button>
                      ),
                      assignment.status === 'IN_PROGRESS' && (
                        <Button key="complete" size="small" type="primary"
                          onClick={() => handleAssignmentStatusChange(selectedTask.id, assignment.id, 'COMPLETED')}>
                          Tamamladım
                        </Button>
                      ),
                    ].filter(Boolean) : []}
                  >
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          style={{ backgroundColor: assignmentStatusColors[assignment.status] === 'success' ? '#52c41a' : '#1677ff' }}
                          icon={<UserOutlined />}
                        >
                          {assignment.assignee?.fio?.[0]}
                        </Avatar>
                      }
                      title={
                        <Space>
                          <Text strong>{assignment.assignee?.fio}</Text>
                          <Tag color={assignmentStatusColors[assignment.status]}>
                            {assignmentStatusLabels[assignment.status] || assignment.status}
                          </Tag>
                          {isCurrentUser && <Tag color="blue">Sen</Tag>}
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={0}>
                          <Text type="secondary">{assignment.assignee?.position}</Text>
                          {assignment.comment && <Text style={{ fontSize: 12 }}>"{assignment.comment}"</Text>}
                          {assignment.completedAt && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              Tamamlandı: {dayjs(assignment.completedAt).format('DD.MM.YYYY HH:mm')}
                            </Text>
                          )}
                        </Space>
                      }
                    />
                  </List.Item>
                );
              }}
            />

            <Divider orientation="left">
              <Space><MessageOutlined /> Mesajlar</Space>
            </Divider>

            {/* Messages / Comment Thread */}
            <div style={{
              maxHeight: 300, overflowY: 'auto', marginBottom: 12,
              padding: 12, background: '#fafafa', borderRadius: 8,
              border: '1px solid #f0f0f0',
            }}>
              {taskMessages.length === 0 ? (
                <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: 20 }}>
                  Henüz mesaj yok. Görevle ilgili mesaj yazabilirsiniz.
                </Text>
              ) : (
                <Timeline
                  items={taskMessages.map((msg: any) => ({
                    color: msg.authorId === currentUserId ? 'blue' : 'gray',
                    children: (
                      <div>
                        <Space>
                          <Text strong style={{ fontSize: 13 }}>{msg.authorName}</Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {dayjs(msg.createdAt).format('DD.MM.YYYY HH:mm')}
                          </Text>
                        </Space>
                        <div style={{ marginTop: 4 }}>
                          <Text>{msg.text}</Text>
                        </div>
                      </div>
                    ),
                  }))}
                />
              )}
            </div>

            {/* Message Input */}
            <Space.Compact style={{ width: '100%' }}>
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Mesaj yazın..."
                onPressEnter={handleSendMessage}
                disabled={sendingMessage}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSendMessage}
                loading={sendingMessage}
                disabled={!newMessage.trim()}
              >
                Gönder
              </Button>
            </Space.Compact>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Tasks;

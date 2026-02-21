import React, { useState, useEffect } from 'react';
import {
  Card, Button, Modal, Form, Input, DatePicker, Tag, Space,
  message, Typography, Row, Col, Statistic, Progress, Slider, Select, Popconfirm, List,
} from 'antd';
import {
  PlusOutlined, CheckCircleOutlined, ClockCircleOutlined,
  TrophyOutlined, RocketOutlined, DeleteOutlined, EditOutlined,
  FlagOutlined,
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import apiClient from '../api/client';
import { useI18n } from '../i18n';

const { Text, Title } = Typography;

const ProjectProgress: React.FC = () => {
  const { id: projectId } = useParams();
  const { t } = useI18n();
  const [summary, setSummary] = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editMilestone, setEditMilestone] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (projectId) {
      fetchSummary();
      fetchMilestones();
    }
  }, [projectId]);

  const fetchSummary = async () => {
    try {
      const res = await apiClient.get('/progress/summary', { params: { projectId } });
      setSummary(res.data);
    } catch { /* ignore */ }
  };

  const fetchMilestones = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/progress', { params: { projectId } });
      setMilestones(res.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleSave = async (values: any) => {
    try {
      if (editMilestone) {
        await apiClient.put(`/progress/${editMilestone.id}`, {
          title: values.title,
          description: values.description,
          dueDate: values.dueDate?.toISOString(),
          sortOrder: values.sortOrder,
        });
      } else {
        await apiClient.post('/progress', {
          projectId,
          title: values.title,
          description: values.description,
          dueDate: values.dueDate?.toISOString(),
          sortOrder: values.sortOrder || milestones.length,
        });
      }
      message.success(t.app.success);
      setModalVisible(false);
      setEditMilestone(null);
      form.resetFields();
      fetchMilestones();
      fetchSummary();
    } catch {
      message.error(t.app.error);
    }
  };

  const handleProgressUpdate = async (id: string, progress: number) => {
    try {
      const status = progress >= 100 ? 'COMPLETED' : progress > 0 ? 'IN_PROGRESS' : 'PENDING';
      await apiClient.put(`/progress/${id}`, { progress, status });
      fetchMilestones();
      fetchSummary();
    } catch { /* ignore */ }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await apiClient.put(`/progress/${id}`, { status });
      message.success(t.app.success);
      fetchMilestones();
      fetchSummary();
    } catch {
      message.error(t.app.error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/progress/${id}`);
      message.success(t.app.success);
      fetchMilestones();
      fetchSummary();
    } catch {
      message.error(t.app.error);
    }
  };

  const milestoneStatusColors: Record<string, string> = {
    PENDING: 'default', IN_PROGRESS: 'processing', COMPLETED: 'success', DELAYED: 'error', CANCELLED: 'default',
  };
  const milestoneStatusLabels: Record<string, string> = {
    PENDING: t.progress?.statuses?.PENDING || 'Pending',
    IN_PROGRESS: t.progress?.statuses?.IN_PROGRESS || 'In Progress',
    COMPLETED: t.progress?.statuses?.COMPLETED || 'Completed',
    DELAYED: t.progress?.statuses?.DELAYED || 'Delayed',
    CANCELLED: t.progress?.statuses?.CANCELLED || 'Cancelled',
  };

  const totalDocs = summary ? Object.values(summary.documents || {}).reduce((a: number, b: any) => a + b, 0) as number : 0;
  const signedDocs = summary?.documents?.SIGNED || 0;
  const docProgress = totalDocs > 0 ? Math.round((signedDocs / totalDocs) * 100) : 0;

  const totalWork = summary ? Object.values(summary.workItems || {}).reduce((a: number, b: any) => a + b, 0) as number : 0;
  const completedWork = (summary?.workItems?.COMPLETED || 0) + (summary?.workItems?.ACCEPTED || 0);
  const workProgress = totalWork > 0 ? Math.round((completedWork / totalWork) * 100) : 0;

  const totalTasks = summary ? Object.values(summary.tasks || {}).reduce((a: number, b: any) => a + b, 0) as number : 0;
  const completedTasks = summary?.tasks?.COMPLETED || 0;
  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div>
      {/* Overall Progress */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title={t.progress?.overallProgress || 'Overall Progress'} value={summary?.overallProgress || 0} suffix="%" prefix={<RocketOutlined />} />
            <Progress percent={summary?.overallProgress || 0} status="active" />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title={t.progress?.documentsProgress || 'Documents'} value={docProgress} suffix="%" prefix={<CheckCircleOutlined />} />
            <Progress percent={docProgress} size="small" />
            <Text type="secondary">{signedDocs}/{totalDocs}</Text>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title={t.progress?.workProgress || 'Work Items'} value={workProgress} suffix="%" prefix={<FlagOutlined />} />
            <Progress percent={workProgress} size="small" strokeColor="#52c41a" />
            <Text type="secondary">{completedWork}/{totalWork}</Text>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title={t.progress?.taskProgress || 'Tasks'} value={taskProgress} suffix="%" prefix={<ClockCircleOutlined />} />
            <Progress percent={taskProgress} size="small" strokeColor="#1677ff" />
            <Text type="secondary">{completedTasks}/{totalTasks}</Text>
          </Card>
        </Col>
      </Row>

      {/* Corrections Summary */}
      {summary?.corrections && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24}>
            <Card title={t.progress?.correctionsSummary || 'Corrections Summary'} size="small">
              <Row gutter={16}>
                <Col span={6}><Statistic title={t.corrections?.statuses?.OPEN || 'Open'} value={summary.corrections.OPEN || 0} valueStyle={{ color: '#ff4d4f' }} /></Col>
                <Col span={6}><Statistic title={t.corrections?.statuses?.IN_PROGRESS || 'In Progress'} value={summary.corrections.IN_PROGRESS || 0} valueStyle={{ color: '#faad14' }} /></Col>
                <Col span={6}><Statistic title={t.corrections?.statuses?.RESOLVED || 'Resolved'} value={summary.corrections.RESOLVED || 0} valueStyle={{ color: '#52c41a' }} /></Col>
                <Col span={6}><Statistic title={t.corrections?.statuses?.CLOSED || 'Closed'} value={summary.corrections.CLOSED || 0} /></Col>
              </Row>
            </Card>
          </Col>
        </Row>
      )}

      {/* Milestones */}
      <Card
        title={t.progress?.milestones || 'Milestones'}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditMilestone(null); setModalVisible(true); }}>
            {t.progress?.addMilestone || 'Add Milestone'}
          </Button>
        }
      >
        <List
          loading={loading}
          dataSource={milestones}
          renderItem={(milestone: any) => (
            <List.Item
              actions={[
                <Button size="small" icon={<EditOutlined />} onClick={() => {
                  setEditMilestone(milestone);
                  form.setFieldsValue({
                    title: milestone.title,
                    description: milestone.description,
                    dueDate: milestone.dueDate ? dayjs(milestone.dueDate) : null,
                    sortOrder: milestone.sortOrder,
                  });
                  setModalVisible(true);
                }} />,
                milestone.status !== 'COMPLETED' ? (
                  <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                    onClick={() => handleStatusChange(milestone.id, 'COMPLETED')}>
                    {t.progress?.complete || 'Complete'}
                  </Button>
                ) : null,
                <Popconfirm title={t.app.confirm} onConfirm={() => handleDelete(milestone.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>,
              ].filter(Boolean)}
            >
              <List.Item.Meta
                avatar={
                  <Progress
                    type="circle"
                    percent={milestone.progress}
                    size={60}
                    status={milestone.status === 'DELAYED' ? 'exception' : undefined}
                  />
                }
                title={
                  <Space>
                    <Text strong>{milestone.title}</Text>
                    <Tag color={milestoneStatusColors[milestone.status]}>{milestoneStatusLabels[milestone.status]}</Tag>
                    {milestone.dueDate && (
                      <Text type={dayjs(milestone.dueDate).isBefore(dayjs()) && milestone.status !== 'COMPLETED' ? 'danger' : 'secondary'}>
                        {dayjs(milestone.dueDate).format('DD.MM.YYYY')}
                      </Text>
                    )}
                  </Space>
                }
                description={
                  <div>
                    {milestone.description && <Text type="secondary">{milestone.description}</Text>}
                    <div style={{ maxWidth: 400, marginTop: 8 }}>
                      <Slider
                        value={milestone.progress}
                        onChange={(val) => handleProgressUpdate(milestone.id, val)}
                        marks={{ 0: '0%', 25: '25%', 50: '50%', 75: '75%', 100: '100%' }}
                      />
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Card>

      {/* Add/Edit Milestone Modal */}
      <Modal
        title={editMilestone ? (t.progress?.editMilestone || 'Edit Milestone') : (t.progress?.addMilestone || 'Add Milestone')}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setEditMilestone(null); form.resetFields(); }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="title" label={t.app.name} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t.app.description}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="dueDate" label={t.tasks?.dueDate || 'Due Date'}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="sortOrder" label={t.progress?.order || 'Order'}>
            <Input type="number" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProjectProgress;

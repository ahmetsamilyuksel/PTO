import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Statistic, List, Tag, Typography, Select, Spin, Empty,
  Badge, Space, Alert, message,
} from 'antd';
import {
  FileTextOutlined, CheckCircleOutlined, ClockCircleOutlined,
  WarningOutlined, ExclamationCircleOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import apiClient, { getApiError } from '../api/client';
import type { Project, DashboardStats, AuditLog, AttentionItem } from '../types';
import { useI18n } from '../i18n';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(projectId);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);

  const actionLabels: Record<string, string> = {
    CREATE: t.dashboard?.actions?.CREATE || 'Oluşturma',
    UPDATE: t.dashboard?.actions?.UPDATE || 'Güncelleme',
    DELETE: t.dashboard?.actions?.DELETE || 'Silme',
    STATUS_CHANGE: t.dashboard?.actions?.STATUS_CHANGE || 'Durum Değişikliği',
    SIGN: t.dashboard?.actions?.SIGN || 'İmzalama',
    UPLOAD: t.dashboard?.actions?.UPLOAD || 'Yükleme',
    DOWNLOAD: t.dashboard?.actions?.DOWNLOAD || 'İndirme',
    LOGIN: t.dashboard?.actions?.LOGIN || 'Giriş',
    EXPORT: t.dashboard?.actions?.EXPORT || 'Dışa Aktarma',
  };

  const priorityLabels: Record<string, { color: string; label: string }> = {
    high: { color: 'red', label: t.tasks?.priorities?.HIGH || 'Yüksek' },
    medium: { color: 'orange', label: t.tasks?.priorities?.MEDIUM || 'Orta' },
    low: { color: 'blue', label: t.tasks?.priorities?.LOW || 'Düşük' },
  };

  useEffect(() => { fetchProjects(); }, []);
  useEffect(() => { if (selectedProjectId) fetchDashboard(selectedProjectId); }, [selectedProjectId]);
  useEffect(() => { if (projectId) setSelectedProjectId(projectId); }, [projectId]);

  const fetchProjects = async () => {
    try {
      const response = await apiClient.get('/projects');
      const data = response.data.data || response.data || [];
      setProjects(data);
      if (!selectedProjectId && data.length > 0) setSelectedProjectId(data[0].id);
    } catch (error) {
      message.error(getApiError(error, t.app.error));
    }
  };

  const fetchDashboard = async (pid: string) => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/projects/${pid}/dashboard`);
      setStats(response.data);
    } catch (error) {
      message.error(getApiError(error, t.app.error));
      setStats({ totalDocuments: 0, signedDocuments: 0, pendingDocuments: 0, missingCertificates: 0, recentActivity: [], attentionItems: [] });
    } finally {
      setLoading(false);
    }
  };

  const handleProjectChange = (value: string) => {
    setSelectedProjectId(value);
    navigate(`/projects/${value}`);
  };

  const getActionColor = (action: string): string => {
    const colors: Record<string, string> = { CREATE: 'green', UPDATE: 'blue', DELETE: 'red', STATUS_CHANGE: 'orange', SIGN: 'purple', UPLOAD: 'cyan', DOWNLOAD: 'default', LOGIN: 'default', EXPORT: 'geekblue' };
    return colors[action] || 'default';
  };

  const getAttentionIcon = (type: AttentionItem['type']) => {
    switch (type) {
      case 'pending_signature': return <ClockCircleOutlined style={{ color: '#faad14' }} />;
      case 'missing_cert': return <WarningOutlined style={{ color: '#ff4d4f' }} />;
      case 'upcoming_test': return <ExclamationCircleOutlined style={{ color: '#1677ff' }} />;
      case 'overdue': return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      default: return <ExclamationCircleOutlined />;
    }
  };

  if (!projects.length && !loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Empty description={t.app.noData} image={Empty.PRESENTED_IMAGE_SIMPLE}>
          <Alert message={t.project?.setup || 'Proje oluşturun'} type="info" showIcon style={{ maxWidth: 400, margin: '0 auto', textAlign: 'left' }} />
        </Empty>
      </div>
    );
  }

  return (
    <Spin spinning={loading}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Row justify="space-between" align="middle" gutter={[16, 12]}>
          <Col xs={24} sm={12}><Title level={3} style={{ margin: 0 }}>{t.dashboard?.title}</Title></Col>
          <Col xs={24} sm={12}>
            <Select value={selectedProjectId} onChange={handleProjectChange} style={{ width: '100%', maxWidth: 300 }} placeholder={t.dashboard?.selectProject}
              options={projects.map((p) => ({ value: p.id, label: p.code ? `${p.code} — ${p.name}` : p.name }))} />
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable><Statistic title={t.dashboard?.totalDocuments} value={stats?.totalDocuments || 0} prefix={<FileTextOutlined />} valueStyle={{ color: '#1677ff' }} /></Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable><Statistic title={t.dashboard?.signedDocuments} value={stats?.signedDocuments || 0} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} /></Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable><Statistic title={t.dashboard?.pendingDocuments} value={stats?.pendingDocuments || 0} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#faad14' }} /></Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable><Statistic title={t.dashboard?.missingCertificates} value={stats?.missingCertificates || 0} prefix={<SafetyCertificateOutlined />} valueStyle={{ color: '#ff4d4f' }} /></Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title={<Space><WarningOutlined style={{ color: '#faad14' }} /><span>{t.dashboard?.needsAttention}</span>{stats?.attentionItems && stats.attentionItems.length > 0 && <Badge count={stats.attentionItems.length} />}</Space>} style={{ height: '100%' }}>
              {stats?.attentionItems && stats.attentionItems.length > 0 ? (
                <List dataSource={stats.attentionItems}
                  renderItem={(item: AttentionItem) => (
                    <List.Item actions={[<Tag color={priorityLabels[item.priority]?.color}>{priorityLabels[item.priority]?.label}</Tag>]}>
                      <List.Item.Meta avatar={getAttentionIcon(item.type)} title={item.title}
                        description={<Space direction="vertical" size={0}><Text type="secondary">{item.description}</Text>{item.dueDate && <Text type="secondary" style={{ fontSize: 12 }}>{t.tasks?.dueDate}: {dayjs(item.dueDate).format('DD.MM.YYYY')}</Text>}</Space>} />
                    </List.Item>
                  )} />
              ) : (
                <Empty description={t.app.noData} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title={t.dashboard?.recentActivity} style={{ height: '100%' }}>
              {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                <List dataSource={stats.recentActivity}
                  renderItem={(item: AuditLog) => (
                    <List.Item>
                      <List.Item.Meta
                        title={<Space><Tag color={getActionColor(item.action)}>{actionLabels[item.action] || item.action}</Tag><Text>{item.entityType}</Text></Space>}
                        description={<Space><Text type="secondary">{item.user?.fullName || 'Sistem'}</Text><Text type="secondary">{dayjs(item.createdAt).format('DD.MM.YYYY HH:mm')}</Text></Space>} />
                    </List.Item>
                  )} />
              ) : (
                <Empty description={t.app.noData} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </Col>
        </Row>
      </Space>
    </Spin>
  );
};

export default Dashboard;

import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  List,
  Tag,
  Typography,
  Select,
  Spin,
  Empty,
  Badge,
  Space,
  Alert,
} from 'antd';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import apiClient from '../api/client';
import type { Project, DashboardStats, AuditLog, AttentionItem } from '../types';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(projectId);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      fetchDashboard(selectedProjectId);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (projectId) {
      setSelectedProjectId(projectId);
    }
  }, [projectId]);

  const fetchProjects = async () => {
    try {
      const response = await apiClient.get('/projects');
      const data = response.data.data || response.data || [];
      setProjects(data);
      if (!selectedProjectId && data.length > 0) {
        setSelectedProjectId(data[0].id);
      }
    } catch {
      // handle silently
    }
  };

  const fetchDashboard = async (pid: string) => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/projects/${pid}/dashboard`);
      setStats(response.data);
    } catch {
      setStats({
        totalDocuments: 0,
        signedDocuments: 0,
        pendingDocuments: 0,
        missingCertificates: 0,
        recentActivity: [],
        attentionItems: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProjectChange = (value: string) => {
    setSelectedProjectId(value);
    navigate(`/projects/${value}`);
  };

  const getActionLabel = (action: string): string => {
    const labels: Record<string, string> = {
      CREATE: 'Создание',
      UPDATE: 'Изменение',
      DELETE: 'Удаление',
      STATUS_CHANGE: 'Смена статуса',
      SIGN: 'Подписание',
      UPLOAD: 'Загрузка',
      DOWNLOAD: 'Скачивание',
      LOGIN: 'Вход',
      EXPORT: 'Экспорт',
    };
    return labels[action] || action;
  };

  const getActionColor = (action: string): string => {
    const colors: Record<string, string> = {
      CREATE: 'green',
      UPDATE: 'blue',
      DELETE: 'red',
      STATUS_CHANGE: 'orange',
      SIGN: 'purple',
      UPLOAD: 'cyan',
      DOWNLOAD: 'default',
      LOGIN: 'default',
      EXPORT: 'geekblue',
    };
    return colors[action] || 'default';
  };

  const getPriorityTag = (priority: AttentionItem['priority']) => {
    const config = {
      high: { color: 'red', label: 'Высокий' },
      medium: { color: 'orange', label: 'Средний' },
      low: { color: 'blue', label: 'Низкий' },
    };
    const c = config[priority];
    return <Tag color={c.color}>{c.label}</Tag>;
  };

  const getAttentionIcon = (type: AttentionItem['type']) => {
    switch (type) {
      case 'pending_signature':
        return <ClockCircleOutlined style={{ color: '#faad14' }} />;
      case 'missing_cert':
        return <WarningOutlined style={{ color: '#ff4d4f' }} />;
      case 'upcoming_test':
        return <ExclamationCircleOutlined style={{ color: '#1677ff' }} />;
      case 'overdue':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return <ExclamationCircleOutlined />;
    }
  };

  if (!projects.length && !loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Empty
          description="Нет доступных проектов"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Alert
            message="Создайте первый проект"
            description="Перейдите в раздел создания проекта, чтобы настроить новый объект строительства."
            type="info"
            showIcon
            style={{ maxWidth: 400, margin: '0 auto', textAlign: 'left' }}
          />
        </Empty>
      </div>
    );
  }

  return (
    <Spin spinning={loading}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={3} style={{ margin: 0 }}>
              Панель управления
            </Title>
          </Col>
          <Col>
            <Select
              value={selectedProjectId}
              onChange={handleProjectChange}
              style={{ width: 300 }}
              placeholder="Выберите проект"
              options={projects.map((p) => ({
                value: p.id,
                label: p.code ? `${p.code} — ${p.name}` : p.name,
              }))}
            />
          </Col>
        </Row>

        {/* Stats Cards */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable>
              <Statistic
                title="Всего документов"
                value={stats?.totalDocuments || 0}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: '#1677ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable>
              <Statistic
                title="Подписано"
                value={stats?.signedDocuments || 0}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable>
              <Statistic
                title="Ожидают подписи"
                value={stats?.pendingDocuments || 0}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable>
              <Statistic
                title="Нет сертификатов"
                value={stats?.missingCertificates || 0}
                prefix={<SafetyCertificateOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          {/* Attention Section */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space>
                  <WarningOutlined style={{ color: '#faad14' }} />
                  <span>Требуют внимания</span>
                  {stats?.attentionItems && stats.attentionItems.length > 0 && (
                    <Badge count={stats.attentionItems.length} />
                  )}
                </Space>
              }
              style={{ height: '100%' }}
            >
              {stats?.attentionItems && stats.attentionItems.length > 0 ? (
                <List
                  dataSource={stats.attentionItems}
                  renderItem={(item: AttentionItem) => (
                    <List.Item
                      actions={[getPriorityTag(item.priority)]}
                    >
                      <List.Item.Meta
                        avatar={getAttentionIcon(item.type)}
                        title={item.title}
                        description={
                          <Space direction="vertical" size={0}>
                            <Text type="secondary">{item.description}</Text>
                            {item.dueDate && (
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                Срок: {dayjs(item.dueDate).format('DD.MM.YYYY')}
                              </Text>
                            )}
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty
                  description="Нет срочных задач"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
            </Card>
          </Col>

          {/* Recent Activity */}
          <Col xs={24} lg={12}>
            <Card
              title="Последние действия"
              style={{ height: '100%' }}
            >
              {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                <List
                  dataSource={stats.recentActivity}
                  renderItem={(item: AuditLog) => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space>
                            <Tag color={getActionColor(item.action)}>
                              {getActionLabel(item.action)}
                            </Tag>
                            <Text>{item.entityType}</Text>
                          </Space>
                        }
                        description={
                          <Space>
                            <Text type="secondary">
                              {item.user?.fullName || 'Система'}
                            </Text>
                            <Text type="secondary">
                              {dayjs(item.createdAt).format('DD.MM.YYYY HH:mm')}
                            </Text>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty
                  description="Нет записей"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
            </Card>
          </Col>
        </Row>
      </Space>
    </Spin>
  );
};

export default Dashboard;

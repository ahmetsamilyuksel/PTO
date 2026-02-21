import React from 'react';
import { Timeline, Tag, Typography, Space, Empty } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  EditOutlined,
  SendOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  AuditOutlined,
  FormOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { WorkflowTransition, DocumentStatus, TransitionAction } from '../types';

const { Text } = Typography;

interface WorkflowStatusProps {
  transitions: WorkflowTransition[];
  currentStatus: DocumentStatus;
}

const ACTION_CONFIG: Record<
  TransitionAction,
  { icon: React.ReactNode; color: string; label: string }
> = {
  CREATE: {
    icon: <FileTextOutlined />,
    color: 'blue',
    label: 'Создание',
  },
  SUBMIT: {
    icon: <SendOutlined />,
    color: 'blue',
    label: 'Отправка на проверку',
  },
  REVIEW: {
    icon: <AuditOutlined />,
    color: 'purple',
    label: 'Проверка',
  },
  APPROVE: {
    icon: <CheckCircleOutlined />,
    color: 'green',
    label: 'Утверждение',
  },
  SIGN: {
    icon: <FormOutlined />,
    color: 'green',
    label: 'Подписание',
  },
  REJECT: {
    icon: <CloseCircleOutlined />,
    color: 'red',
    label: 'Отклонение',
  },
  REVISE: {
    icon: <EditOutlined />,
    color: 'orange',
    label: 'Доработка',
  },
  ARCHIVE: {
    icon: <InboxOutlined />,
    color: 'gray',
    label: 'Архивация',
  },
};

const STATUS_LABELS: Record<DocumentStatus, string> = {
  DRAFT: 'Черновик',
  IN_REVIEW: 'На проверке',
  PENDING_SIGNATURE: 'На подписи',
  SIGNED: 'Подписан',
  REJECTED: 'Отклонён',
  ARCHIVED: 'Архив',
};

const STATUS_COLORS: Record<DocumentStatus, string> = {
  DRAFT: 'gold',
  IN_REVIEW: 'blue',
  PENDING_SIGNATURE: 'purple',
  SIGNED: 'green',
  REJECTED: 'red',
  ARCHIVED: 'default',
};

const WorkflowStatus: React.FC<WorkflowStatusProps> = ({ transitions, currentStatus }) => {
  if (!transitions || transitions.length === 0) {
    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <Text>Текущий статус: </Text>
          <Tag color={STATUS_COLORS[currentStatus]}>
            {STATUS_LABELS[currentStatus]}
          </Tag>
        </div>
        <Empty description="Нет записей о переходах" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  const sortedTransitions = [...transitions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const items = sortedTransitions.map((transition, index) => {
    const config = ACTION_CONFIG[transition.action] || {
      icon: <ClockCircleOutlined />,
      color: 'gray',
      label: transition.action,
    };

    const isLast = index === sortedTransitions.length - 1;

    return {
      dot: config.icon,
      color: config.color,
      children: (
        <div
          style={{
            padding: '4px 0',
            opacity: isLast ? 1 : 0.85,
          }}
        >
          <Space direction="vertical" size={2}>
            <Space>
              <Text strong style={{ fontSize: isLast ? 14 : 13 }}>
                {config.label}
              </Text>
              {transition.toStatus && (
                <Tag
                  color={STATUS_COLORS[transition.toStatus]}
                  style={{ fontSize: 11 }}
                >
                  {STATUS_LABELS[transition.toStatus]}
                </Tag>
              )}
            </Space>
            <Space>
              {transition.performedBy && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {transition.performedBy.fullName}
                </Text>
              )}
              <Text type="secondary" style={{ fontSize: 12 }}>
                {dayjs(transition.createdAt).format('DD.MM.YYYY HH:mm')}
              </Text>
            </Space>
            {transition.comment && (
              <Text style={{ fontSize: 12, fontStyle: 'italic' }}>
                {transition.comment}
              </Text>
            )}
          </Space>
        </div>
      ),
    };
  });

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Text>Текущий статус: </Text>
        <Tag color={STATUS_COLORS[currentStatus]} style={{ fontSize: 13 }}>
          {STATUS_LABELS[currentStatus]}
        </Tag>
      </div>
      <Timeline items={items} />
    </div>
  );
};

export default WorkflowStatus;

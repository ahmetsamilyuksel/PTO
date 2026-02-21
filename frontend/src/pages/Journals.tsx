import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  message,
  Drawer,
  Descriptions,
  List,
  Row,
  Col,
  Spin,
  Card,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  BookOutlined,
  EyeOutlined,
  DownloadOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import apiClient from '../api/client';
import type {
  Journal,
  JournalType,
  JournalStatus,
  JournalEntry,
  Person,
} from '../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

const JOURNAL_TYPE_LABELS: Record<JournalType, string> = {
  GENERAL: 'Общий журнал работ',
  CONCRETE: 'Журнал бетонных работ',
  WELDING: 'Журнал сварочных работ',
  PILE: 'Журнал свайных работ',
  ANTICORROSION: 'Журнал антикоррозийной защиты',
  GEODETIC: 'Журнал геодезических работ',
  SAFETY: 'Журнал ТБ',
};

const JOURNAL_STATUS_CONFIG: Record<JournalStatus, { color: string; label: string }> = {
  ACTIVE: { color: 'green', label: 'Активный' },
  COMPLETED: { color: 'blue', label: 'Завершён' },
  ARCHIVED: { color: 'default', label: 'Архив' },
};

const Journals: React.FC = () => {
  const { id: projectId } = useParams();

  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(false);

  // Create journal modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [createLoading, setCreateLoading] = useState(false);

  // Detail drawer
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [entriesTotal, setEntriesTotal] = useState(0);
  const [entriesPage, setEntriesPage] = useState(1);

  // Entry modal
  const [entryModalVisible, setEntryModalVisible] = useState(false);
  const [entryForm] = Form.useForm();
  const [entryLoading, setEntryLoading] = useState(false);

  const fetchJournals = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const response = await apiClient.get(`/projects/${projectId}/journals`);
      const data = response.data;
      setJournals(data.data || data || []);
    } catch {
      message.error('Ошибка загрузки журналов');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchJournals();
  }, [fetchJournals]);

  const openJournalDetail = async (id: string) => {
    setDetailLoading(true);
    setDetailDrawerVisible(true);
    try {
      const [journalRes, entriesRes] = await Promise.all([
        apiClient.get(`/journals/${id}`),
        apiClient.get(`/journals/${id}/entries`, { params: { page: 1, pageSize: 20 } }),
      ]);
      setSelectedJournal(journalRes.data);
      const eData = entriesRes.data;
      setEntries(eData.data || eData || []);
      setEntriesTotal(eData.total || 0);
      setEntriesPage(1);
    } catch {
      message.error('Ошибка загрузки журнала');
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchEntries = async (journalId: string, pg: number) => {
    try {
      const response = await apiClient.get(`/journals/${journalId}/entries`, {
        params: { page: pg, pageSize: 20 },
      });
      const data = response.data;
      setEntries(data.data || data || []);
      setEntriesTotal(data.total || 0);
      setEntriesPage(pg);
    } catch {
      message.error('Ошибка загрузки записей');
    }
  };

  const handleCreateJournal = async () => {
    try {
      const values = await createForm.validateFields();
      setCreateLoading(true);
      const payload = {
        ...values,
        projectId,
        startDate: values.startDate?.format('YYYY-MM-DD'),
      };
      await apiClient.post(`/projects/${projectId}/journals`, payload);
      message.success('Журнал создан');
      setCreateModalVisible(false);
      createForm.resetFields();
      fetchJournals();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; errorFields?: unknown };
      if (!err.errorFields) {
        message.error(err.response?.data?.message || 'Ошибка создания журнала');
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const handleAddEntry = async () => {
    if (!selectedJournal) return;
    try {
      const values = await entryForm.validateFields();
      setEntryLoading(true);
      const payload = {
        ...values,
        date: values.date?.format('YYYY-MM-DD'),
      };
      await apiClient.post(`/journals/${selectedJournal.id}/entries`, payload);
      message.success('Запись добавлена');
      setEntryModalVisible(false);
      entryForm.resetFields();
      fetchEntries(selectedJournal.id, 1);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; errorFields?: unknown };
      if (!err.errorFields) {
        message.error(err.response?.data?.message || 'Ошибка добавления записи');
      }
    } finally {
      setEntryLoading(false);
    }
  };

  const handleExportPdf = async (journalId: string) => {
    try {
      const response = await apiClient.get(`/journals/${journalId}/export`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `journal-${journalId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('Ошибка экспорта журнала');
    }
  };

  const columns = [
    {
      title: 'Номер',
      dataIndex: 'number',
      key: 'number',
      width: 120,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Тип',
      dataIndex: 'type',
      key: 'type',
      width: 200,
      render: (type: JournalType) => (
        <Tag icon={<BookOutlined />} color="blue">
          {JOURNAL_TYPE_LABELS[type] || type}
        </Tag>
      ),
    },
    {
      title: 'Наименование',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: JournalStatus) => {
        const cfg = JOURNAL_STATUS_CONFIG[status];
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Ответственный',
      key: 'responsible',
      width: 180,
      render: (_: unknown, record: Journal) => record.responsible?.fullName || '—',
    },
    {
      title: 'Дата начала',
      dataIndex: 'startDate',
      key: 'startDate',
      width: 120,
      render: (date: string) => (date ? dayjs(date).format('DD.MM.YYYY') : '—'),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: Journal) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => openJournalDetail(record.id)}
          />
          <Button
            type="link"
            icon={<DownloadOutlined />}
            onClick={() => handleExportPdf(record.id)}
            title="Экспорт PDF"
          />
        </Space>
      ),
    },
  ];

  const entryColumns = [
    {
      title: '№',
      dataIndex: 'entryNumber',
      key: 'entryNumber',
      width: 60,
    },
    {
      title: 'Дата',
      dataIndex: 'date',
      key: 'date',
      width: 110,
      render: (date: string) => dayjs(date).format('DD.MM.YYYY'),
    },
    {
      title: 'Погода',
      dataIndex: 'weather',
      key: 'weather',
      width: 100,
    },
    {
      title: 'Бригада',
      dataIndex: 'crewCount',
      key: 'crewCount',
      width: 80,
      render: (v: number) => (v ? `${v} чел.` : '—'),
    },
    {
      title: 'Описание работ',
      dataIndex: 'workDescription',
      key: 'workDescription',
      ellipsis: true,
    },
    {
      title: 'Материалы',
      dataIndex: 'materialsUsed',
      key: 'materialsUsed',
      width: 150,
      ellipsis: true,
    },
    {
      title: 'Контроль',
      dataIndex: 'controlNotes',
      key: 'controlNotes',
      width: 150,
      ellipsis: true,
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            Журналы
          </Title>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            Создать журнал
          </Button>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={journals}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      {/* Create Journal Modal */}
      <Modal
        title="Создать журнал"
        open={createModalVisible}
        onOk={handleCreateJournal}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        okText="Создать"
        cancelText="Отмена"
        confirmLoading={createLoading}
        width={600}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="type"
            label="Тип журнала"
            rules={[{ required: true, message: 'Выберите тип' }]}
          >
            <Select
              placeholder="Выберите тип журнала"
              options={Object.entries(JOURNAL_TYPE_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="title"
            label="Наименование"
            rules={[{ required: true, message: 'Введите наименование' }]}
          >
            <Input placeholder="Общий журнал работ по объекту ЖК Солнечный" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="number" label="Номер журнала">
                <Input placeholder="ОЖР-001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="startDate" label="Дата начала" initialValue={dayjs()}>
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Journal Detail Drawer */}
      <Drawer
        title={selectedJournal ? `${selectedJournal.number} — ${selectedJournal.title}` : 'Журнал'}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setSelectedJournal(null);
          setEntries([]);
        }}
        width={900}
        extra={
          selectedJournal && (
            <Space>
              <Button
                icon={<PlusOutlined />}
                type="primary"
                onClick={() => setEntryModalVisible(true)}
                disabled={selectedJournal.status !== 'ACTIVE'}
              >
                Добавить запись
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => handleExportPdf(selectedJournal.id)}
              >
                Экспорт PDF
              </Button>
            </Space>
          )
        }
      >
        <Spin spinning={detailLoading}>
          {selectedJournal && (
            <>
              <Descriptions bordered column={2} size="small" style={{ marginBottom: 24 }}>
                <Descriptions.Item label="Тип">
                  {JOURNAL_TYPE_LABELS[selectedJournal.type]}
                </Descriptions.Item>
                <Descriptions.Item label="Статус">
                  <Tag color={JOURNAL_STATUS_CONFIG[selectedJournal.status].color}>
                    {JOURNAL_STATUS_CONFIG[selectedJournal.status].label}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Номер">
                  {selectedJournal.number}
                </Descriptions.Item>
                <Descriptions.Item label="Ответственный">
                  {selectedJournal.responsible?.fullName || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Дата начала">
                  {selectedJournal.startDate
                    ? dayjs(selectedJournal.startDate).format('DD.MM.YYYY')
                    : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Дата окончания">
                  {selectedJournal.endDate
                    ? dayjs(selectedJournal.endDate).format('DD.MM.YYYY')
                    : '—'}
                </Descriptions.Item>
              </Descriptions>

              <Divider orientation="left">Записи журнала</Divider>

              <Table
                columns={entryColumns}
                dataSource={entries}
                rowKey="id"
                size="small"
                pagination={{
                  current: entriesPage,
                  pageSize: 20,
                  total: entriesTotal,
                  showTotal: (t) => `Всего: ${t}`,
                  onChange: (pg) => {
                    if (selectedJournal) fetchEntries(selectedJournal.id, pg);
                  },
                }}
              />
            </>
          )}
        </Spin>
      </Drawer>

      {/* Add Entry Modal */}
      <Modal
        title="Добавить запись в журнал"
        open={entryModalVisible}
        onOk={handleAddEntry}
        onCancel={() => {
          setEntryModalVisible(false);
          entryForm.resetFields();
        }}
        okText="Добавить"
        cancelText="Отмена"
        confirmLoading={entryLoading}
        width={700}
      >
        <Form form={entryForm} layout="vertical">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="date"
                label="Дата"
                rules={[{ required: true, message: 'Укажите дату' }]}
                initialValue={dayjs()}
              >
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="weather" label="Погода">
                <Select
                  allowClear
                  placeholder="Погода"
                  options={[
                    { value: 'Ясно', label: 'Ясно' },
                    { value: 'Облачно', label: 'Облачно' },
                    { value: 'Пасмурно', label: 'Пасмурно' },
                    { value: 'Дождь', label: 'Дождь' },
                    { value: 'Снег', label: 'Снег' },
                    { value: 'Ветер', label: 'Ветер' },
                    { value: 'Мороз', label: 'Мороз' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="temperature" label="Температура">
                <Input placeholder="-5°C ... +2°C" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="crewCount" label="Численность бригады">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="12" />
          </Form.Item>
          <Form.Item
            name="workDescription"
            label="Описание выполненных работ"
            rules={[{ required: true, message: 'Введите описание' }]}
          >
            <TextArea
              rows={4}
              placeholder="Выполнено бетонирование фундаментной плиты в осях А-Г/1-5. Объём бетона В25 — 120 м³."
            />
          </Form.Item>
          <Form.Item name="materialsUsed" label="Использованные материалы">
            <TextArea
              rows={2}
              placeholder="Бетон В25 F150 W6 — 120 м³, арматура А500С — 12 т"
            />
          </Form.Item>
          <Form.Item name="controlNotes" label="Контроль качества">
            <TextArea rows={2} placeholder="Отобраны образцы бетона серия №1234" />
          </Form.Item>
          <Form.Item name="notes" label="Примечания">
            <TextArea rows={2} placeholder="Дополнительные замечания" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Journals;

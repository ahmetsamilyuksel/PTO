import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Space, Tag, Typography, Modal, Form, Input, Select,
  DatePicker, InputNumber, message, Drawer, Descriptions, List,
  Row, Col, Spin, Divider,
} from 'antd';
import {
  PlusOutlined, BookOutlined, EyeOutlined, DownloadOutlined,
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import apiClient, { getApiError } from '../api/client';
import type { Journal, JournalType, JournalStatus, JournalEntry } from '../types';
import { useI18n } from '../i18n';

const { Title, Text } = Typography;
const { TextArea } = Input;

const Journals: React.FC = () => {
  const { id: projectId } = useParams();
  const { t } = useI18n();

  const journalTypeLabels: Record<string, string> = {
    GENERAL: t.journal?.types?.GENERAL || 'Genel İş Günlüğü',
    CONCRETE: t.journal?.types?.CONCRETE || 'Beton İşleri Günlüğü',
    WELDING: t.journal?.types?.WELDING || 'Kaynak İşleri Günlüğü',
    PILE_DRIVING: t.journal?.types?.PILE_DRIVING || 'Kazık Çakma Günlüğü',
    ANTICORROSION: t.journal?.types?.ANTICORROSION || 'Antikorozyon Günlüğü',
    GEODETIC: t.journal?.types?.GEODETIC || 'Jeodezik Günlük',
    INSULATION: t.journal?.types?.OTHER || 'İzolasyon Günlüğü',
    INSTALLATION: t.journal?.types?.OTHER || 'Montaj Günlüğü',
    OTHER: t.journal?.types?.OTHER || 'Diğer',
  };

  const journalStatusLabels: Record<string, { color: string; label: string }> = {
    ACTIVE: { color: 'green', label: t.project?.statuses?.ACTIVE || 'Aktif' },
    CLOSED: { color: 'blue', label: t.progress?.statuses?.COMPLETED || 'Kapatıldı' },
    ARCHIVED: { color: 'default', label: t.project?.statuses?.ARCHIVED || 'Arşiv' },
  };

  const weatherOptions = [
    { value: 'CLEAR', label: t.journal?.weatherTypes?.CLEAR || 'Açık' },
    { value: 'CLOUDY', label: t.journal?.weatherTypes?.CLOUDY || 'Bulutlu' },
    { value: 'OVERCAST', label: t.journal?.weatherTypes?.OVERCAST || 'Kapalı' },
    { value: 'RAIN', label: t.journal?.weatherTypes?.RAIN || 'Yağmurlu' },
    { value: 'SNOW', label: t.journal?.weatherTypes?.SNOW || 'Karlı' },
    { value: 'WIND', label: t.journal?.weatherTypes?.WIND || 'Rüzgarlı' },
    { value: 'FROST', label: t.journal?.weatherTypes?.FROST || 'Dondurucu' },
  ];

  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [createLoading, setCreateLoading] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [entriesTotal, setEntriesTotal] = useState(0);
  const [entriesPage, setEntriesPage] = useState(1);
  const [entryModalVisible, setEntryModalVisible] = useState(false);
  const [entryForm] = Form.useForm();
  const [entryLoading, setEntryLoading] = useState(false);

  const fetchJournals = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const response = await apiClient.get('/journals', { params: { projectId } });
      const data = response.data;
      setJournals(data.data || data || []);
    } catch (error) {
      message.error(getApiError(error, t.app.error));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchJournals(); }, [fetchJournals]);

  const openJournalDetail = async (id: string) => {
    setDetailLoading(true);
    setDetailDrawerVisible(true);
    try {
      const [journalRes, entriesRes] = await Promise.all([
        apiClient.get(`/journals/${id}`),
        apiClient.get(`/journals/${id}/entries`, { params: { page: 1, limit: 20 } }),
      ]);
      setSelectedJournal(journalRes.data);
      const eData = entriesRes.data;
      setEntries(eData.data || eData || []);
      setEntriesTotal(eData.total || 0);
      setEntriesPage(1);
    } catch (error) {
      message.error(getApiError(error, t.app.error));
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchEntries = async (journalId: string, pg: number) => {
    try {
      const response = await apiClient.get(`/journals/${journalId}/entries`, { params: { page: pg, limit: 20 } });
      const data = response.data;
      setEntries(data.data || data || []);
      setEntriesTotal(data.total || 0);
      setEntriesPage(pg);
    } catch (error) {
      message.error(getApiError(error, t.app.error));
    }
  };

  const handleCreateJournal = async () => {
    try {
      const values = await createForm.validateFields();
      setCreateLoading(true);
      await apiClient.post('/journals', {
        projectId, journalType: values.type, title: values.title,
        startDate: values.startDate?.format('YYYY-MM-DD'),
      });
      message.success(t.app.success);
      setCreateModalVisible(false);
      createForm.resetFields();
      fetchJournals();
    } catch (error: unknown) {
      const msg = getApiError(error, t.app.error);
      if (msg) message.error(msg);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleAddEntry = async () => {
    if (!selectedJournal) return;
    try {
      const values = await entryForm.validateFields();
      setEntryLoading(true);
      await apiClient.post(`/journals/${selectedJournal.id}/entries`, {
        entryDate: values.date?.format('YYYY-MM-DD'),
        weatherConditions: values.weather,
        temperature: values.temperature,
        crewInfo: values.crewCount ? `${values.crewCount} kişi` : undefined,
        workDescription: values.workDescription,
        materialsUsed: values.materialsUsed,
        controlActions: values.controlNotes,
        notes: values.notes,
      });
      message.success(t.app.success);
      setEntryModalVisible(false);
      entryForm.resetFields();
      fetchEntries(selectedJournal.id, 1);
    } catch (error: unknown) {
      const msg = getApiError(error, t.app.error);
      if (msg) message.error(msg);
    } finally {
      setEntryLoading(false);
    }
  };

  const handleExportPdf = async (journalId: string) => {
    try {
      const response = await apiClient.get(`/journals/${journalId}/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `journal-${journalId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      message.error(getApiError(error, t.app.error));
    }
  };

  const columns = [
    { title: t.app.type, dataIndex: 'journalType', key: 'journalType', width: 200, render: (type: JournalType) => <Tag icon={<BookOutlined />} color="blue">{journalTypeLabels[type] || type}</Tag> },
    { title: t.app.name, dataIndex: 'title', key: 'title', ellipsis: true },
    { title: t.app.status, dataIndex: 'status', key: 'status', width: 120, render: (status: JournalStatus) => { const cfg = journalStatusLabels[status] || { color: 'default', label: status }; return <Tag color={cfg.color}>{cfg.label}</Tag>; } },
    { title: t.corrections?.assignedTo || 'Sorumlu', key: 'responsible', width: 180, render: (_: unknown, record: Journal) => record.responsible?.fullName || '—' },
    { title: t.project?.startDate || 'Başlangıç', dataIndex: 'startDate', key: 'startDate', width: 120, render: (date: string) => (date ? dayjs(date).format('DD.MM.YYYY') : '—') },
    { title: t.app.actions, key: 'actions', width: 120, render: (_: unknown, record: Journal) => (
      <Space>
        <Button type="link" icon={<EyeOutlined />} onClick={() => openJournalDetail(record.id)} />
        <Button type="link" icon={<DownloadOutlined />} onClick={() => handleExportPdf(record.id)} title={t.journal?.exportPdf} />
      </Space>
    )},
  ];

  const entryColumns = [
    { title: '#', dataIndex: 'entryNumber', key: 'entryNumber', width: 60 },
    { title: t.app.date, dataIndex: 'entryDate', key: 'entryDate', width: 110, render: (date: string) => dayjs(date).format('DD.MM.YYYY') },
    { title: t.journal?.weather, dataIndex: 'weatherConditions', key: 'weatherConditions', width: 100 },
    { title: t.journal?.crew, dataIndex: 'crewInfo', key: 'crewInfo', width: 80, render: (v: string) => (v || '—') },
    { title: t.journal?.workDescription, dataIndex: 'workDescription', key: 'workDescription', ellipsis: true },
    { title: t.journal?.materialsUsed, dataIndex: 'materialsUsed', key: 'materialsUsed', width: 150, ellipsis: true },
    { title: t.journal?.controlActions, dataIndex: 'controlActions', key: 'controlActions', width: 150, ellipsis: true },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col><Title level={3} style={{ margin: 0 }}>{t.journal?.title}</Title></Col>
        <Col><Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>{t.app.create}</Button></Col>
      </Row>
      <Table columns={columns} dataSource={journals} rowKey="id" loading={loading} pagination={false} />

      <Modal title={t.app.create} open={createModalVisible} onOk={handleCreateJournal} onCancel={() => { setCreateModalVisible(false); createForm.resetFields(); }} okText={t.app.create} cancelText={t.app.cancel} confirmLoading={createLoading} width={600}>
        <Form form={createForm} layout="vertical">
          <Form.Item name="type" label={t.app.type} rules={[{ required: true, message: t.app.required }]}>
            <Select options={Object.entries(journalTypeLabels).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="title" label={t.app.name} rules={[{ required: true, message: t.app.required }]}><Input /></Form.Item>
          <Form.Item name="startDate" label={t.project?.startDate} initialValue={dayjs()}><DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" /></Form.Item>
        </Form>
      </Modal>

      <Drawer title={selectedJournal ? selectedJournal.title : t.journal?.title} open={detailDrawerVisible} onClose={() => { setDetailDrawerVisible(false); setSelectedJournal(null); setEntries([]); }} width={900}
        extra={selectedJournal && (
          <Space>
            <Button icon={<PlusOutlined />} type="primary" onClick={() => setEntryModalVisible(true)} disabled={selectedJournal.status !== 'ACTIVE'}>{t.journal?.addEntry}</Button>
            <Button icon={<DownloadOutlined />} onClick={() => handleExportPdf(selectedJournal.id)}>{t.journal?.exportPdf}</Button>
          </Space>
        )}>
        <Spin spinning={detailLoading}>
          {selectedJournal && (
            <>
              <Descriptions bordered column={2} size="small" style={{ marginBottom: 24 }}>
                <Descriptions.Item label={t.app.type}>{journalTypeLabels[selectedJournal.journalType] || selectedJournal.journalType}</Descriptions.Item>
                <Descriptions.Item label={t.app.status}><Tag color={journalStatusLabels[selectedJournal.status]?.color}>{journalStatusLabels[selectedJournal.status]?.label}</Tag></Descriptions.Item>
                <Descriptions.Item label={t.doc?.number}>—</Descriptions.Item>
                <Descriptions.Item label={t.corrections?.assignedTo || 'Sorumlu'}>{selectedJournal.responsible?.fullName || '—'}</Descriptions.Item>
                <Descriptions.Item label={t.project?.startDate}>{selectedJournal.startDate ? dayjs(selectedJournal.startDate).format('DD.MM.YYYY') : '—'}</Descriptions.Item>
                <Descriptions.Item label={t.project?.plannedEndDate || 'Bitiş'}>{selectedJournal.endDate ? dayjs(selectedJournal.endDate).format('DD.MM.YYYY') : '—'}</Descriptions.Item>
              </Descriptions>
              <Divider orientation="left">{t.journal?.entries}</Divider>
              <Table columns={entryColumns} dataSource={entries} rowKey="id" size="small" pagination={{ current: entriesPage, pageSize: 20, total: entriesTotal, showTotal: (totalCount) => `${totalCount} ${t.tasks?.items || 'kayıt'}`, onChange: (pg) => { if (selectedJournal) fetchEntries(selectedJournal.id, pg); } }} />
            </>
          )}
        </Spin>
      </Drawer>

      <Modal title={t.journal?.addEntry} open={entryModalVisible} onOk={handleAddEntry} onCancel={() => { setEntryModalVisible(false); entryForm.resetFields(); }} okText={t.app.create} cancelText={t.app.cancel} confirmLoading={entryLoading} width={700}>
        <Form form={entryForm} layout="vertical">
          <Row gutter={16}>
            <Col span={8}><Form.Item name="date" label={t.app.date} rules={[{ required: true }]} initialValue={dayjs()}><DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" /></Form.Item></Col>
            <Col span={8}><Form.Item name="weather" label={t.journal?.weather}><Select allowClear options={weatherOptions} /></Form.Item></Col>
            <Col span={8}><Form.Item name="temperature" label={t.journal?.temperature}><Input /></Form.Item></Col>
          </Row>
          <Form.Item name="crewCount" label={t.journal?.crew}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="workDescription" label={t.journal?.workDescription} rules={[{ required: true, message: t.app.required }]}><TextArea rows={4} /></Form.Item>
          <Form.Item name="materialsUsed" label={t.journal?.materialsUsed}><TextArea rows={2} /></Form.Item>
          <Form.Item name="controlNotes" label={t.journal?.controlActions}><TextArea rows={2} /></Form.Item>
          <Form.Item name="notes" label={t.journal?.notes}><TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Journals;

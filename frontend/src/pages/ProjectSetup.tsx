import React, { useState, useEffect } from 'react';
import {
  Steps,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Card,
  Row,
  Col,
  Space,
  Table,
  Tree,
  Typography,
  message,
  Divider,
  Modal,
  InputNumber,
  Descriptions,
  Tag,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ArrowRightOutlined,
  ArrowLeftOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { DataNode } from 'antd/es/tree';
import dayjs from 'dayjs';
import apiClient, { getApiError } from '../api/client';
import { useI18n } from '../i18n';
import type { Organization, Person, ProjectType, OrgRole, PersonRole } from '../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface OrgEntry {
  key: string;
  role: OrgRole;
  organizationId?: string;
  organization?: Organization;
  newOrg?: Partial<Organization>;
  contractNumber?: string;
  contractDate?: string;
}

interface PersonEntry {
  key: string;
  role: PersonRole;
  personId?: string;
  person?: Person;
  newPerson?: Partial<Person>;
  organizationId?: string;
  orderNumber?: string;
  orderDate?: string;
}

interface LocationEntry {
  key: string;
  name: string;
  code?: string;
  parentKey?: string;
  level: number;
  children?: LocationEntry[];
}

interface WorkItemEntry {
  key: string;
  name: string;
  code?: string;
  workType?: string;
  unit?: string;
  quantity?: number;
  locationKey?: string;
}

const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: 'RESIDENTIAL', label: 'Жилое строительство' },
  { value: 'COMMERCIAL', label: 'Коммерческое строительство' },
  { value: 'INDUSTRIAL', label: 'Промышленное строительство' },
  { value: 'INFRASTRUCTURE', label: 'Инфраструктура' },
  { value: 'RENOVATION', label: 'Реконструкция' },
];

const ORG_ROLES: { value: OrgRole; label: string }[] = [
  { value: 'CLIENT', label: 'Заказчик' },
  { value: 'GENERAL_CONTRACTOR', label: 'Генподрядчик' },
  { value: 'SUBCONTRACTOR', label: 'Субподрядчик' },
  { value: 'DESIGNER', label: 'Проектировщик' },
  { value: 'SUPERVISOR', label: 'Технический надзор' },
  { value: 'AUTHORITY', label: 'Надзорный орган' },
];

const PERSON_ROLES: { value: PersonRole; label: string }[] = [
  { value: 'PROJECT_MANAGER', label: 'Руководитель проекта' },
  { value: 'SITE_ENGINEER', label: 'Инженер на площадке' },
  { value: 'PTO_ENGINEER', label: 'Инженер ПТО' },
  { value: 'QC_INSPECTOR', label: 'Инспектор по качеству' },
  { value: 'FOREMAN', label: 'Прораб' },
  { value: 'SURVEYOR', label: 'Геодезист' },
  { value: 'SAFETY_ENGINEER', label: 'Инженер по ТБ' },
  { value: 'DESIGNER_SUPERVISOR', label: 'Авторский надзор' },
  { value: 'CLIENT_REPRESENTATIVE', label: 'Представитель заказчика' },
];

const WORK_TYPES = [
  'Земляные работы',
  'Фундаменты',
  'Монолитные работы',
  'Каменная кладка',
  'Металлоконструкции',
  'Кровля',
  'Фасады',
  'Внутренняя отделка',
  'Электромонтаж',
  'Сантехника',
  'Вентиляция',
  'Слаботочные системы',
  'Благоустройство',
  'Гидроизоляция',
  'Теплоизоляция',
  'Сварочные работы',
  'Антикоррозийная защита',
];

const ProjectSetup: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [projectForm] = Form.useForm();
  const [orgForm] = Form.useForm();
  const [personForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();
  const navigate = useNavigate();

  // Data state
  const [organizations, setOrganizations] = useState<OrgEntry[]>([]);
  const [persons, setPersons] = useState<PersonEntry[]>([]);
  const [locations, setLocations] = useState<LocationEntry[]>([]);
  const [workItems, setWorkItems] = useState<WorkItemEntry[]>([]);

  // Existing data from API
  const [existingOrgs, setExistingOrgs] = useState<Organization[]>([]);
  const [existingPersons, setExistingPersons] = useState<Person[]>([]);

  // Modals
  const [orgModalVisible, setOrgModalVisible] = useState(false);
  const [personModalVisible, setPersonModalVisible] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [workItemModalVisible, setWorkItemModalVisible] = useState(false);
  const [selectedParentLocation, setSelectedParentLocation] = useState<string | undefined>();

  const [locationForm] = Form.useForm();
  const [workItemForm] = Form.useForm();

  useEffect(() => {
    fetchExistingData();
  }, []);

  const fetchExistingData = async () => {
    try {
      const [orgsRes, personsRes] = await Promise.all([
        apiClient.get('/organizations').catch(() => ({ data: [] })),
        apiClient.get('/persons').catch(() => ({ data: [] })),
      ]);
      setExistingOrgs(orgsRes.data.data || orgsRes.data || []);
      setExistingPersons(personsRes.data.data || personsRes.data || []);
    } catch {
      // ignore
    }
  };

  // ===== Organizations =====
  const handleAddOrg = () => {
    orgForm.validateFields().then((values) => {
      const existing = existingOrgs.find((o) => o.id === values.organizationId);
      const entry: OrgEntry = {
        key: `org-${Date.now()}`,
        role: values.role,
        organizationId: values.organizationId,
        organization: existing,
        contractNumber: values.contractNumber,
        contractDate: values.contractDate?.format('YYYY-MM-DD'),
        newOrg: !values.organizationId
          ? { name: values.orgName, inn: values.inn, address: values.orgAddress }
          : undefined,
      };
      setOrganizations([...organizations, entry]);
      orgForm.resetFields();
      setOrgModalVisible(false);
    });
  };

  // ===== Persons =====
  const handleAddPerson = () => {
    personForm.validateFields().then((values) => {
      const existing = existingPersons.find((p) => p.id === values.personId);
      const entry: PersonEntry = {
        key: `person-${Date.now()}`,
        role: values.role,
        personId: values.personId,
        person: existing,
        organizationId: values.organizationId,
        orderNumber: values.orderNumber,
        orderDate: values.orderDate?.format('YYYY-MM-DD'),
        newPerson: !values.personId
          ? { fullName: values.fullName, position: values.position, email: values.email, phone: values.phone }
          : undefined,
      };
      setPersons([...persons, entry]);
      personForm.resetFields();
      setPersonModalVisible(false);
    });
  };

  // ===== Locations =====
  const handleAddLocation = () => {
    locationForm.validateFields().then((values) => {
      const entry: LocationEntry = {
        key: `loc-${Date.now()}`,
        name: values.name,
        code: values.code,
        parentKey: selectedParentLocation,
        level: selectedParentLocation ? getLocationLevel(selectedParentLocation) + 1 : 0,
      };

      if (selectedParentLocation) {
        setLocations(addChildLocation(locations, selectedParentLocation, entry));
      } else {
        setLocations([...locations, entry]);
      }

      locationForm.resetFields();
      setLocationModalVisible(false);
      setSelectedParentLocation(undefined);
    });
  };

  const getLocationLevel = (key: string): number => {
    const find = (items: LocationEntry[]): number => {
      for (const item of items) {
        if (item.key === key) return item.level;
        if (item.children) {
          const level = find(item.children);
          if (level >= 0) return level;
        }
      }
      return -1;
    };
    return find(locations);
  };

  const addChildLocation = (
    items: LocationEntry[],
    parentKey: string,
    child: LocationEntry,
  ): LocationEntry[] => {
    return items.map((item) => {
      if (item.key === parentKey) {
        return { ...item, children: [...(item.children || []), child] };
      }
      if (item.children) {
        return { ...item, children: addChildLocation(item.children, parentKey, child) };
      }
      return item;
    });
  };

  const locationsToTreeData = (items: LocationEntry[]): DataNode[] => {
    return items.map((item) => ({
      key: item.key,
      title: item.code ? `${item.code} — ${item.name}` : item.name,
      children: item.children ? locationsToTreeData(item.children) : undefined,
    }));
  };

  // ===== Work Items =====
  const handleAddWorkItem = () => {
    workItemForm.validateFields().then((values) => {
      const entry: WorkItemEntry = {
        key: `wi-${Date.now()}`,
        name: values.name,
        code: values.code,
        workType: values.workType,
        unit: values.unit,
        quantity: values.quantity,
        locationKey: values.locationKey,
      };
      setWorkItems([...workItems, entry]);
      workItemForm.resetFields();
      setWorkItemModalVisible(false);
    });
  };

  const flattenLocations = (items: LocationEntry[]): { key: string; name: string }[] => {
    const result: { key: string; name: string }[] = [];
    const flatten = (list: LocationEntry[], prefix: string) => {
      list.forEach((item) => {
        const label = prefix ? `${prefix} > ${item.name}` : item.name;
        result.push({ key: item.key, name: label });
        if (item.children) flatten(item.children, label);
      });
    };
    flatten(items, '');
    return result;
  };

  // ===== Submit =====
  const handleSubmit = async () => {
    setLoading(true);
    try {
      const projectValues = await projectForm.validateFields();

      const payload = {
        name: projectValues.name,
        code: projectValues.code,
        address: projectValues.address,
        type: projectValues.type,
        contractNumber: projectValues.contractNumber,
        contractDate: projectValues.contractDate?.format('YYYY-MM-DD'),
        startDate: projectValues.startDate?.format('YYYY-MM-DD'),
        endDate: projectValues.endDate?.format('YYYY-MM-DD'),
        description: projectValues.description,
        organizations: organizations.map((o) => ({
          role: o.role,
          organizationId: o.organizationId,
          newOrganization: o.newOrg,
          contractNumber: o.contractNumber,
          contractDate: o.contractDate,
        })),
        persons: persons.map((p) => ({
          role: p.role,
          personId: p.personId,
          newPerson: p.newPerson,
          organizationId: p.organizationId,
          orderNumber: p.orderNumber,
          orderDate: p.orderDate,
        })),
        locations: serializeLocations(locations),
        workItems: workItems.map((w) => ({
          name: w.name,
          code: w.code,
          workType: w.workType,
          unit: w.unit,
          quantity: w.quantity,
          locationKey: w.locationKey,
        })),
      };

      const response = await apiClient.post('/projects', payload);
      message.success(t.messages.projectCreated);
      navigate(`/projects/${response.data.id}`);
    } catch (error: unknown) {
      const msg = getApiError(error, t.messages.projectCreateFailed);
      if (msg) message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const serializeLocations = (items: LocationEntry[]): unknown[] => {
    return items.map((item) => ({
      key: item.key,
      name: item.name,
      code: item.code,
      level: item.level,
      children: item.children ? serializeLocations(item.children) : [],
    }));
  };

  const steps = [
    { title: 'Проект', description: 'Основная информация' },
    { title: 'Организации', description: 'Участники строительства' },
    { title: 'Персонал', description: 'Ответственные лица' },
    { title: 'Зоны', description: 'Структура объекта' },
    { title: 'Работы', description: 'Виды работ' },
    { title: 'Обзор', description: 'Проверка и создание' },
  ];

  const orgRoleLabel = (role: string) =>
    ORG_ROLES.find((r) => r.value === role)?.label || role;
  const personRoleLabel = (role: string) =>
    PERSON_ROLES.find((r) => r.value === role)?.label || role;

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <Form form={projectForm} layout="vertical" style={{ maxWidth: 700 }}>
            <Row gutter={16}>
              <Col span={16}>
                <Form.Item
                  name="name"
                  label={t.project.name}
                  rules={[{ required: true, message: t.messages.enterName }]}
                >
                  <Input placeholder="ЖК Солнечный, корпус 3" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="code"
                  label={t.project.code}
                  rules={[{ required: true, message: t.messages.enterCode }]}
                >
                  <Input placeholder="SOL-03" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="address" label="Адрес объекта">
              <Input placeholder="г. Москва, ул. Строительная, д. 1" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name="type"
                  label={t.project.type}
                  rules={[{ required: true, message: t.messages.selectType }]}
                >
                  <Select options={PROJECT_TYPES} placeholder="Выберите тип" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="contractNumber" label="Номер договора">
                  <Input placeholder="ДС-2024/001" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="contractDate" label="Дата договора">
                  <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="startDate" label="Дата начала">
                  <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="endDate" label="Дата окончания">
                  <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="description" label="Описание">
              <TextArea rows={3} placeholder="Краткое описание проекта" />
            </Form.Item>
          </Form>
        );

      case 1:
        return (
          <div>
            <Space style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setOrgModalVisible(true)}
              >
                Добавить организацию
              </Button>
            </Space>
            <Table
              dataSource={organizations}
              rowKey="key"
              pagination={false}
              columns={[
                {
                  title: 'Роль',
                  dataIndex: 'role',
                  render: (role: string) => <Tag color="blue">{orgRoleLabel(role)}</Tag>,
                },
                {
                  title: 'Организация',
                  render: (_: unknown, record: OrgEntry) =>
                    record.organization?.name || record.newOrg?.name || '—',
                },
                {
                  title: 'ИНН',
                  render: (_: unknown, record: OrgEntry) =>
                    record.organization?.inn || record.newOrg?.inn || '—',
                },
                {
                  title: 'Договор',
                  render: (_: unknown, record: OrgEntry) =>
                    record.contractNumber || '—',
                },
                {
                  title: '',
                  width: 60,
                  render: (_: unknown, record: OrgEntry) => (
                    <Popconfirm
                      title="Удалить организацию?"
                      onConfirm={() =>
                        setOrganizations(organizations.filter((o) => o.key !== record.key))
                      }
                    >
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  ),
                },
              ]}
            />
            <Modal
              title="Добавить организацию"
              open={orgModalVisible}
              onOk={handleAddOrg}
              onCancel={() => {
                setOrgModalVisible(false);
                orgForm.resetFields();
              }}
              okText="Добавить"
              cancelText="Отмена"
              width={600}
            >
              <Form form={orgForm} layout="vertical">
                <Form.Item
                  name="role"
                  label={t.person.role}
                  rules={[{ required: true, message: t.messages.selectRole }]}
                >
                  <Select options={ORG_ROLES} placeholder={t.messages.selectRole} />
                </Form.Item>
                <Form.Item name="organizationId" label="Существующая организация">
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Выберите или создайте новую"
                    options={existingOrgs.map((o) => ({
                      value: o.id,
                      label: o.inn ? `${o.name} (ИНН: ${o.inn})` : o.name,
                    }))}
                  />
                </Form.Item>
                <Divider>Или создать новую</Divider>
                <Form.Item name="orgName" label="Название организации">
                  <Input placeholder="ООО Строитель" />
                </Form.Item>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="inn" label="ИНН">
                      <Input placeholder="1234567890" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="orgAddress" label="Адрес">
                      <Input placeholder="г. Москва" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="contractNumber" label="Номер договора">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="contractDate" label="Дата договора">
                      <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            </Modal>
          </div>
        );

      case 2:
        return (
          <div>
            <Space style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setPersonModalVisible(true)}
              >
                Добавить специалиста
              </Button>
            </Space>
            <Table
              dataSource={persons}
              rowKey="key"
              pagination={false}
              columns={[
                {
                  title: 'Роль',
                  dataIndex: 'role',
                  render: (role: string) => <Tag color="green">{personRoleLabel(role)}</Tag>,
                },
                {
                  title: 'ФИО',
                  render: (_: unknown, record: PersonEntry) =>
                    record.person?.fullName || record.newPerson?.fullName || '—',
                },
                {
                  title: 'Должность',
                  render: (_: unknown, record: PersonEntry) =>
                    record.person?.position || record.newPerson?.position || '—',
                },
                {
                  title: 'Приказ',
                  render: (_: unknown, record: PersonEntry) =>
                    record.orderNumber || '—',
                },
                {
                  title: '',
                  width: 60,
                  render: (_: unknown, record: PersonEntry) => (
                    <Popconfirm
                      title="Удалить специалиста?"
                      onConfirm={() =>
                        setPersons(persons.filter((p) => p.key !== record.key))
                      }
                    >
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  ),
                },
              ]}
            />
            <Modal
              title="Добавить специалиста"
              open={personModalVisible}
              onOk={handleAddPerson}
              onCancel={() => {
                setPersonModalVisible(false);
                personForm.resetFields();
              }}
              okText="Добавить"
              cancelText="Отмена"
              width={600}
            >
              <Form form={personForm} layout="vertical">
                <Form.Item
                  name="role"
                  label={t.person.role}
                  rules={[{ required: true, message: t.messages.selectRole }]}
                >
                  <Select options={PERSON_ROLES} placeholder={t.messages.selectRole} />
                </Form.Item>
                <Form.Item name="personId" label="Существующий специалист">
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Выберите или создайте нового"
                    options={existingPersons.map((p) => ({
                      value: p.id,
                      label: p.position ? `${p.fullName} — ${p.position}` : p.fullName,
                    }))}
                  />
                </Form.Item>
                <Divider>Или создать нового</Divider>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="fullName" label="ФИО">
                      <Input placeholder="Иванов Иван Иванович" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="position" label="Должность">
                      <Input placeholder="Главный инженер" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="email" label="Email">
                      <Input placeholder="email@company.ru" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="phone" label="Телефон">
                      <Input placeholder="+7 (999) 123-45-67" />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="organizationId" label="Организация">
                  <Select
                    allowClear
                    placeholder="Выберите организацию"
                    options={[
                      ...organizations.map((o) => ({
                        value: o.organizationId || o.key,
                        label: o.organization?.name || o.newOrg?.name || '—',
                      })),
                    ]}
                  />
                </Form.Item>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="orderNumber" label="Номер приказа">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="orderDate" label="Дата приказа">
                      <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            </Modal>
          </div>
        );

      case 3:
        return (
          <div>
            <Space style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setSelectedParentLocation(undefined);
                  setLocationModalVisible(true);
                }}
              >
                Добавить корневую зону
              </Button>
            </Space>
            {locations.length > 0 ? (
              <Card>
                <Tree
                  treeData={locationsToTreeData(locations)}
                  defaultExpandAll
                  titleRender={(nodeData) => (
                    <Space>
                      <Text>{nodeData.title as string}</Text>
                      <Button
                        type="link"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedParentLocation(nodeData.key as string);
                          setLocationModalVisible(true);
                        }}
                      >
                        + дочерний
                      </Button>
                    </Space>
                  )}
                />
              </Card>
            ) : (
              <Card>
                <Text type="secondary">
                  Создайте структуру объекта: Здание &gt; Секция &gt; Этаж &gt; Помещение
                </Text>
              </Card>
            )}
            <Modal
              title={
                selectedParentLocation
                  ? 'Добавить дочернюю зону'
                  : 'Добавить корневую зону'
              }
              open={locationModalVisible}
              onOk={handleAddLocation}
              onCancel={() => {
                setLocationModalVisible(false);
                locationForm.resetFields();
                setSelectedParentLocation(undefined);
              }}
              okText="Добавить"
              cancelText="Отмена"
            >
              <Form form={locationForm} layout="vertical">
                <Form.Item
                  name="name"
                  label={t.app.name}
                  rules={[{ required: true, message: t.messages.enterName }]}
                >
                  <Input placeholder="Корпус 1 / Секция А / Этаж 1 / Кв. 101" />
                </Form.Item>
                <Form.Item name="code" label="Код">
                  <Input placeholder="K1-SA-E1" />
                </Form.Item>
              </Form>
            </Modal>
          </div>
        );

      case 4:
        return (
          <div>
            <Space style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setWorkItemModalVisible(true)}
              >
                Добавить вид работ
              </Button>
            </Space>
            <Table
              dataSource={workItems}
              rowKey="key"
              pagination={false}
              columns={[
                { title: 'Код', dataIndex: 'code', width: 100 },
                { title: 'Наименование', dataIndex: 'name' },
                {
                  title: 'Вид работ',
                  dataIndex: 'workType',
                  render: (v: string) => v && <Tag>{v}</Tag>,
                },
                { title: 'Ед.', dataIndex: 'unit', width: 80 },
                { title: 'Кол-во', dataIndex: 'quantity', width: 80 },
                {
                  title: 'Зона',
                  dataIndex: 'locationKey',
                  render: (key: string) => {
                    if (!key) return '—';
                    const flat = flattenLocations(locations);
                    const loc = flat.find((l) => l.key === key);
                    return loc?.name || '—';
                  },
                },
                {
                  title: '',
                  width: 60,
                  render: (_: unknown, record: WorkItemEntry) => (
                    <Popconfirm
                      title="Удалить?"
                      onConfirm={() =>
                        setWorkItems(workItems.filter((w) => w.key !== record.key))
                      }
                    >
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  ),
                },
              ]}
            />
            <Modal
              title="Добавить вид работ"
              open={workItemModalVisible}
              onOk={handleAddWorkItem}
              onCancel={() => {
                setWorkItemModalVisible(false);
                workItemForm.resetFields();
              }}
              okText="Добавить"
              cancelText="Отмена"
              width={600}
            >
              <Form form={workItemForm} layout="vertical">
                <Row gutter={16}>
                  <Col span={16}>
                    <Form.Item
                      name="name"
                      label={t.app.name}
                      rules={[{ required: true, message: t.messages.enterName }]}
                    >
                      <Input placeholder="Бетонирование фундаментной плиты" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="code" label="Код">
                      <Input placeholder="Ф-01" />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="workType" label="Вид работ">
                  <Select
                    allowClear
                    showSearch
                    placeholder="Выберите вид"
                    options={WORK_TYPES.map((t) => ({ value: t, label: t }))}
                  />
                </Form.Item>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="unit" label="Единица измерения">
                      <Input placeholder="м³" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="quantity" label="Количество">
                      <InputNumber style={{ width: '100%' }} min={0} />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="locationKey" label="Зона/участок">
                  <Select
                    allowClear
                    placeholder="Выберите зону"
                    options={flattenLocations(locations).map((l) => ({
                      value: l.key,
                      label: l.name,
                    }))}
                  />
                </Form.Item>
              </Form>
            </Modal>
          </div>
        );

      case 5:
        return (
          <div>
            <Title level={4}>Проверка данных проекта</Title>
            <Descriptions bordered column={2} style={{ marginBottom: 24 }}>
              <Descriptions.Item label="Название" span={2}>
                {projectForm.getFieldValue('name') || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Код">
                {projectForm.getFieldValue('code') || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Тип">
                {PROJECT_TYPES.find((t) => t.value === projectForm.getFieldValue('type'))?.label || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Адрес" span={2}>
                {projectForm.getFieldValue('address') || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Договор">
                {projectForm.getFieldValue('contractNumber') || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Дата договора">
                {projectForm.getFieldValue('contractDate')
                  ? dayjs(projectForm.getFieldValue('contractDate')).format('DD.MM.YYYY')
                  : '—'}
              </Descriptions.Item>
            </Descriptions>

            <Card title="Организации" size="small" style={{ marginBottom: 16 }}>
              {organizations.length > 0 ? (
                organizations.map((o) => (
                  <Tag key={o.key} color="blue" style={{ marginBottom: 4 }}>
                    {orgRoleLabel(o.role)}: {o.organization?.name || o.newOrg?.name}
                  </Tag>
                ))
              ) : (
                <Text type="secondary">Не добавлены</Text>
              )}
            </Card>

            <Card title="Персонал" size="small" style={{ marginBottom: 16 }}>
              {persons.length > 0 ? (
                persons.map((p) => (
                  <Tag key={p.key} color="green" style={{ marginBottom: 4 }}>
                    {personRoleLabel(p.role)}: {p.person?.fullName || p.newPerson?.fullName}
                  </Tag>
                ))
              ) : (
                <Text type="secondary">Не добавлены</Text>
              )}
            </Card>

            <Card title="Зоны" size="small" style={{ marginBottom: 16 }}>
              {locations.length > 0 ? (
                <Tree treeData={locationsToTreeData(locations)} defaultExpandAll />
              ) : (
                <Text type="secondary">Не добавлены</Text>
              )}
            </Card>

            <Card title="Работы" size="small" style={{ marginBottom: 16 }}>
              {workItems.length > 0 ? (
                workItems.map((w) => (
                  <Tag key={w.key} style={{ marginBottom: 4 }}>
                    {w.code ? `${w.code}: ` : ''}{w.name}
                  </Tag>
                ))
              ) : (
                <Text type="secondary">Не добавлены</Text>
              )}
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  const handleNext = async () => {
    if (currentStep === 0) {
      try {
        await projectForm.validateFields();
      } catch {
        return;
      }
    }
    setCurrentStep(currentStep + 1);
  };

  return (
    <div>
      <Title level={3}>Создание нового проекта</Title>

      <Steps
        current={currentStep}
        items={steps}
        style={{ marginBottom: 32 }}
        size="small"
      />

      <Card>{renderStep()}</Card>

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          {currentStep > 0 && (
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => setCurrentStep(currentStep - 1)}
            >
              Назад
            </Button>
          )}
        </div>
        <div>
          {currentStep < steps.length - 1 ? (
            <Button type="primary" onClick={handleNext}>
              Далее <ArrowRightOutlined />
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<CheckOutlined />}
              loading={loading}
              onClick={handleSubmit}
            >
              Создать проект
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectSetup;

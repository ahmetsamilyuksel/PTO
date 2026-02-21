import React, { useEffect } from 'react';
import {
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Switch,
  Checkbox,
  Radio,
  Typography,
  Divider,
} from 'antd';
import type { FormInstance } from 'antd';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Text } = Typography;

interface FieldConfig {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'switch' | 'checkbox' | 'radio';
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: unknown;
  rules?: Array<{ message: string; pattern?: RegExp; min?: number; max?: number }>;
  group?: string;
}

interface DocumentFormProps {
  form: FormInstance;
  documentType: string;
  initialValues?: Record<string, unknown>;
  templateFields?: Record<string, unknown>;
  context?: {
    projectName?: string;
    locationName?: string;
    workItemName?: string;
  };
}

const DEFAULT_FIELDS: Record<string, FieldConfig[]> = {
  'Акт освидетельствования скрытых работ': [
    { name: 'workDescription', label: 'Описание выполненных работ', type: 'textarea', required: true },
    { name: 'projectDrawings', label: 'Номера рабочих чертежей', type: 'text' },
    { name: 'materials', label: 'Применённые материалы', type: 'textarea' },
    { name: 'deviations', label: 'Допускаемые отклонения', type: 'textarea' },
    { name: 'inspectionDate', label: 'Дата осмотра', type: 'date', required: true },
    { name: 'conclusion', label: 'Заключение', type: 'textarea', required: true },
    {
      name: 'permitNextWork',
      label: 'Разрешается производство последующих работ',
      type: 'switch',
      defaultValue: true,
    },
    { name: 'nextWorkDescription', label: 'Наименование последующих работ', type: 'text' },
  ],
  'Акт входного контроля': [
    { name: 'materialName', label: 'Наименование материала', type: 'text', required: true },
    { name: 'manufacturer', label: 'Производитель', type: 'text' },
    { name: 'batchNumber', label: 'Номер партии', type: 'text' },
    { name: 'quantity', label: 'Количество', type: 'number' },
    { name: 'unit', label: 'Единица измерения', type: 'text' },
    { name: 'certNumbers', label: 'Номера сертификатов', type: 'text' },
    { name: 'visualInspection', label: 'Результаты визуального осмотра', type: 'textarea', required: true },
    { name: 'measurements', label: 'Результаты замеров', type: 'textarea' },
    {
      name: 'result',
      label: 'Результат контроля',
      type: 'select',
      required: true,
      options: [
        { value: 'accepted', label: 'Принят' },
        { value: 'conditionally_accepted', label: 'Условно принят' },
        { value: 'rejected', label: 'Отклонён' },
      ],
    },
    { name: 'notes', label: 'Примечания', type: 'textarea' },
  ],
  'Протокол испытаний': [
    { name: 'testType', label: 'Вид испытания', type: 'text', required: true },
    { name: 'testMethod', label: 'Метод испытания (ГОСТ)', type: 'text' },
    { name: 'sampleDescription', label: 'Описание образцов', type: 'textarea' },
    { name: 'sampleCount', label: 'Количество образцов', type: 'number' },
    { name: 'testDate', label: 'Дата испытания', type: 'date', required: true },
    { name: 'equipment', label: 'Оборудование', type: 'text' },
    { name: 'results', label: 'Результаты испытаний', type: 'textarea', required: true },
    { name: 'requirements', label: 'Нормативные требования', type: 'textarea' },
    {
      name: 'compliance',
      label: 'Соответствие требованиям',
      type: 'radio',
      options: [
        { value: 'compliant', label: 'Соответствует' },
        { value: 'non_compliant', label: 'Не соответствует' },
      ],
      required: true,
    },
    { name: 'conclusion', label: 'Заключение', type: 'textarea', required: true },
  ],
  'Акт приёмки выполненных работ': [
    { name: 'workDescription', label: 'Описание выполненных работ', type: 'textarea', required: true },
    { name: 'volume', label: 'Объём работ', type: 'text' },
    { name: 'projectDrawings', label: 'Рабочие чертежи', type: 'text' },
    { name: 'startDate', label: 'Дата начала', type: 'date' },
    { name: 'endDate', label: 'Дата окончания', type: 'date' },
    { name: 'deviations', label: 'Выявленные отклонения', type: 'textarea' },
    {
      name: 'acceptance',
      label: 'Решение комиссии',
      type: 'select',
      required: true,
      options: [
        { value: 'accepted', label: 'Работы приняты' },
        { value: 'accepted_with_remarks', label: 'Приняты с замечаниями' },
        { value: 'not_accepted', label: 'Не приняты' },
      ],
    },
    { name: 'remarks', label: 'Замечания', type: 'textarea' },
    { name: 'deadlineForRemarks', label: 'Срок устранения замечаний', type: 'date' },
  ],
};

const DocumentForm: React.FC<DocumentFormProps> = ({
  form,
  documentType,
  initialValues,
  templateFields,
  context,
}) => {
  useEffect(() => {
    if (initialValues) {
      const processedValues: Record<string, unknown> = {};
      Object.entries(initialValues).forEach(([key, value]) => {
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
          processedValues[key] = dayjs(value);
        } else {
          processedValues[key] = value;
        }
      });
      form.setFieldsValue(processedValues);
    }
  }, [initialValues, form]);

  const getFields = (): FieldConfig[] => {
    // First try template fields
    if (templateFields && Array.isArray(templateFields.fields)) {
      return templateFields.fields as FieldConfig[];
    }

    // Then try default fields for known types
    if (DEFAULT_FIELDS[documentType]) {
      return DEFAULT_FIELDS[documentType];
    }

    // Fallback: generic fields
    return [
      { name: 'description', label: 'Описание', type: 'textarea', required: true },
      { name: 'notes', label: 'Примечания', type: 'textarea' },
    ];
  };

  const fields = getFields();

  const renderField = (field: FieldConfig) => {
    const rules = field.required ? [{ required: true, message: `Заполните поле "${field.label}"` }] : [];

    switch (field.type) {
      case 'text':
        return (
          <Form.Item
            key={field.name}
            name={['formData', field.name]}
            label={field.label}
            rules={rules}
          >
            <Input placeholder={field.placeholder} />
          </Form.Item>
        );

      case 'textarea':
        return (
          <Form.Item
            key={field.name}
            name={['formData', field.name]}
            label={field.label}
            rules={rules}
          >
            <TextArea rows={3} placeholder={field.placeholder} />
          </Form.Item>
        );

      case 'number':
        return (
          <Form.Item
            key={field.name}
            name={['formData', field.name]}
            label={field.label}
            rules={rules}
          >
            <InputNumber style={{ width: '100%' }} placeholder={field.placeholder} />
          </Form.Item>
        );

      case 'date':
        return (
          <Form.Item
            key={field.name}
            name={['formData', field.name]}
            label={field.label}
            rules={rules}
          >
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
        );

      case 'select':
        return (
          <Form.Item
            key={field.name}
            name={['formData', field.name]}
            label={field.label}
            rules={rules}
          >
            <Select
              placeholder={field.placeholder || 'Выберите'}
              options={field.options}
              allowClear
            />
          </Form.Item>
        );

      case 'switch':
        return (
          <Form.Item
            key={field.name}
            name={['formData', field.name]}
            label={field.label}
            valuePropName="checked"
            initialValue={field.defaultValue}
          >
            <Switch />
          </Form.Item>
        );

      case 'checkbox':
        return (
          <Form.Item
            key={field.name}
            name={['formData', field.name]}
            valuePropName="checked"
          >
            <Checkbox>{field.label}</Checkbox>
          </Form.Item>
        );

      case 'radio':
        return (
          <Form.Item
            key={field.name}
            name={['formData', field.name]}
            label={field.label}
            rules={rules}
          >
            <Radio.Group options={field.options} />
          </Form.Item>
        );

      default:
        return (
          <Form.Item
            key={field.name}
            name={['formData', field.name]}
            label={field.label}
            rules={rules}
          >
            <Input placeholder={field.placeholder} />
          </Form.Item>
        );
    }
  };

  // Group fields
  const groups = new Map<string, FieldConfig[]>();
  fields.forEach((field) => {
    const groupName = field.group || '__default';
    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }
    groups.get(groupName)!.push(field);
  });

  return (
    <Form form={form} layout="vertical">
      {context && (
        <div style={{ marginBottom: 16 }}>
          {context.projectName && (
            <Text type="secondary">Проект: {context.projectName}</Text>
          )}
          {context.locationName && (
            <>
              {' | '}
              <Text type="secondary">Зона: {context.locationName}</Text>
            </>
          )}
          {context.workItemName && (
            <>
              {' | '}
              <Text type="secondary">Работа: {context.workItemName}</Text>
            </>
          )}
        </div>
      )}

      {Array.from(groups.entries()).map(([groupName, groupFields]) => (
        <div key={groupName}>
          {groupName !== '__default' && (
            <Divider orientation="left" orientationMargin={0}>
              {groupName}
            </Divider>
          )}
          {groupFields.map(renderField)}
        </div>
      ))}
    </Form>
  );
};

export default DocumentForm;

import React, { useState } from 'react';
import {
  Upload,
  Button,
  message,
  Select,
  Space,
  Image,
  Typography,
} from 'antd';
import {
  UploadOutlined,
  InboxOutlined,
  FileImageOutlined,
  FileTextOutlined,
  VideoCameraOutlined,
  FileOutlined,
} from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import apiClient, { getApiError } from '../api/client';
import { useI18n } from '../i18n';
import type { AttachmentType } from '../types';

const { Dragger } = Upload;
const { Text } = Typography;

interface FileUploadProps {
  entityType: 'document' | 'material' | 'journal-entry';
  entityId: string;
  onUploaded?: () => void;
  maxCount?: number;
  accept?: string;
}

const ATTACHMENT_TYPES: { value: AttachmentType; label: string; icon: React.ReactNode }[] = [
  { value: 'PHOTO', label: 'Фото', icon: <FileImageOutlined /> },
  { value: 'SCAN', label: 'Скан', icon: <FileTextOutlined /> },
  { value: 'DRAWING', label: 'Чертёж', icon: <FileTextOutlined /> },
  { value: 'VIDEO', label: 'Видео', icon: <VideoCameraOutlined /> },
  { value: 'DOCUMENT', label: 'Документ', icon: <FileOutlined /> },
  { value: 'OTHER', label: 'Другое', icon: <FileOutlined /> },
];

const FileUpload: React.FC<FileUploadProps> = ({
  entityType,
  entityId,
  onUploaded,
  maxCount,
  accept,
}) => {
  const { t } = useI18n();
  const [attachmentType, setAttachmentType] = useState<AttachmentType>('DOCUMENT');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    maxCount,
    accept,
    fileList,
    customRequest: async (options) => {
      const { file, onSuccess, onError, onProgress } = options;

      const formData = new FormData();
      formData.append('file', file as File);
      formData.append('type', attachmentType);
      formData.append('entityType', entityType);
      formData.append('entityId', entityId);

      try {
        const response = await apiClient.post('/attachments', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
              onProgress?.({ percent });
            }
          },
        });

        onSuccess?.(response.data);
        message.success(t.messages.fileUploaded);
        if (onUploaded) onUploaded();
      } catch (error) {
        onError?.(error as Error);
        message.error(getApiError(error, t.messages.fileUploadFailed));
      }
    },
    onChange: (info) => {
      setFileList(info.fileList);
    },
    onPreview: async (file) => {
      const url = file.url || file.thumbUrl || (file.response?.fileUrl as string);
      if (url && isImage(file.name || '')) {
        setPreviewImage(url);
        setPreviewVisible(true);
      } else if (url) {
        window.open(url, '_blank');
      }
    },
    onRemove: async (file) => {
      if (file.response?.id) {
        try {
          await apiClient.delete(`/attachments/${file.response.id}`);
          message.success(t.messages.fileDeleted);
          if (onUploaded) onUploaded();
        } catch (error) {
          message.error(getApiError(error, t.messages.fileDeleteFailed));
          return false;
        }
      }
      return true;
    },
  };

  const isImage = (fileName: string): boolean => {
    return /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(fileName);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <Space style={{ marginBottom: 8 }}>
        <Text>Тип вложения:</Text>
        <Select
          value={attachmentType}
          onChange={setAttachmentType}
          style={{ width: 160 }}
          options={ATTACHMENT_TYPES.map((t) => ({
            value: t.value,
            label: (
              <Space>
                {t.icon}
                {t.label}
              </Space>
            ),
          }))}
        />
      </Space>

      <Dragger {...uploadProps}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">
          Нажмите или перетащите файлы для загрузки
        </p>
        <p className="ant-upload-hint">
          Поддерживаются одиночные или массовые загрузки файлов.
        </p>
      </Dragger>

      {previewVisible && (
        <Image
          style={{ display: 'none' }}
          preview={{
            visible: previewVisible,
            src: previewImage,
            onVisibleChange: (visible) => setPreviewVisible(visible),
          }}
        />
      )}
    </div>
  );
};

export default FileUpload;

import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Space } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import apiClient, { getApiError } from '../api/client';
import { useI18n } from '../i18n';
import type { LoginResponse } from '../types';

const { Title, Text } = Typography;

interface LoginFormValues {
  email: string;
  password: string;
}

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const onFinish = async (values: LoginFormValues) => {
    setLoading(true);
    try {
      const response = await apiClient.post<LoginResponse>('/auth/login', values);
      const { token, user } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      message.success(t.messages.welcome.replace('{name}', user.fullName));
      navigate(from, { replace: true });
    } catch (error: unknown) {
      message.error(getApiError(error, t.messages.loginFailed));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card
        style={{
          width: 420,
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          borderRadius: 12,
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <Title level={2} style={{ marginBottom: 4 }}>
              {t.app.title}
            </Title>
            <Text type="secondary">{t.app.subtitle}</Text>
          </div>

          <Form
            name="login"
            onFinish={onFinish}
            autoComplete="off"
            layout="vertical"
            size="large"
          >
            <Form.Item
              name="email"
              rules={[
                { required: true, message: t.messages.enterEmail },
                { type: 'email', message: t.messages.invalidEmail },
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder={t.auth.email}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: t.messages.enterPassword }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={t.auth.password}
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                style={{ height: 44 }}
              >
                {t.auth.loginButton}
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  );
};

export default Login;

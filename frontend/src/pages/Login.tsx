import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Space } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../api/client';
import type { LoginResponse } from '../types';

const { Title, Text } = Typography;

interface LoginFormValues {
  email: string;
  password: string;
}

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
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

      message.success(`Добро пожаловать, ${user.fullName}!`);
      navigate(from, { replace: true });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string; message?: string } } };
      message.error(err.response?.data?.error || err.response?.data?.message || 'Ошибка входа. Проверьте учётные данные.');
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
              ПТО DocOps
            </Title>
            <Text type="secondary">Система исполнительной документации</Text>
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
                { required: true, message: 'Введите email' },
                { type: 'email', message: 'Некорректный email' },
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="Email"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Введите пароль' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Пароль"
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
                Войти
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  );
};

export default Login;

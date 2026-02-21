import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Dropdown, Typography, Space, theme } from 'antd';
import {
  DashboardOutlined,
  ProjectOutlined,
  TableOutlined,
  FileTextOutlined,
  ExperimentOutlined,
  BookOutlined,
  FolderOutlined,
  LogoutOutlined,
  UserOutlined,
  PlusOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  GlobalOutlined,
  CheckSquareOutlined,
  BugOutlined,
  RocketOutlined,
  TeamOutlined,
  AppstoreOutlined,
  SnippetsOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation, useParams } from 'react-router-dom';
import type { MenuProps } from 'antd';
import type { User, Project } from '../types';
import apiClient from '../api/client';
import { useI18n, languages, Language } from '../i18n';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { id: projectId } = useParams();
  const { t, lang, setLang } = useI18n();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        setCurrentUser(JSON.parse(userStr));
      } catch {
        // ignore parse errors
      }
    }
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await apiClient.get('/projects');
      setProjects(response.data.data || response.data || []);
    } catch {
      // silently fail - user may not have projects yet
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const getActiveProjectId = (): string | undefined => {
    if (projectId) return projectId;
    const match = location.pathname.match(/\/projects\/([^/]+)/);
    return match ? match[1] : undefined;
  };

  const activeProjectId = getActiveProjectId();

  const buildMenuItems = (): MenuProps['items'] => {
    const items: MenuProps['items'] = [
      {
        key: '/',
        icon: <DashboardOutlined />,
        label: t.menu.dashboard,
      },
      {
        key: 'projects-group',
        icon: <ProjectOutlined />,
        label: t.menu.projects,
        children: [
          ...projects.map((p) => ({
            key: `/projects/${p.id}`,
            label: p.code ? `${p.code} — ${p.name}` : p.name,
          })),
          {
            key: '/project-setup',
            icon: <PlusOutlined />,
            label: t.menu.newProject,
          },
        ],
      },
    ];

    if (activeProjectId) {
      items.push(
        { type: 'divider' as const },
        {
          key: `project-${activeProjectId}-menu`,
          icon: <FolderOutlined />,
          label: t.menu.projects,
          children: [
            {
              key: `/projects/${activeProjectId}/matrix`,
              icon: <TableOutlined />,
              label: t.menu.matrix,
            },
            {
              key: `/projects/${activeProjectId}/documents`,
              icon: <FileTextOutlined />,
              label: t.menu.documents,
            },
            {
              key: `/projects/${activeProjectId}/materials`,
              icon: <ExperimentOutlined />,
              label: t.menu.materials,
            },
            {
              key: `/projects/${activeProjectId}/journals`,
              icon: <BookOutlined />,
              label: t.menu.journals,
            },
            {
              key: `/projects/${activeProjectId}/packages`,
              icon: <FolderOutlined />,
              label: t.menu.packages,
            },
          ],
        },
        { type: 'divider' as const },
        {
          key: `project-${activeProjectId}-ops`,
          icon: <RocketOutlined />,
          label: t.progress?.title || 'Operations',
          children: [
            {
              key: `/projects/${activeProjectId}/tasks`,
              icon: <CheckSquareOutlined />,
              label: t.menu.tasks,
            },
            {
              key: `/projects/${activeProjectId}/corrections`,
              icon: <BugOutlined />,
              label: t.menu.corrections,
            },
            {
              key: `/projects/${activeProjectId}/progress`,
              icon: <RocketOutlined />,
              label: t.menu.progress,
            },
            {
              key: `/projects/${activeProjectId}/team`,
              icon: <TeamOutlined />,
              label: t.menu.team,
            },
            {
              key: `/projects/${activeProjectId}/categories`,
              icon: <AppstoreOutlined />,
              label: t.menu.categories,
            },
            {
              key: `/projects/${activeProjectId}/templates`,
              icon: <SnippetsOutlined />,
              label: t.menu.templates,
            },
          ],
        },
      );
    }

    return items;
  };

  const langMenuItems: MenuProps['items'] = (Object.keys(languages) as Language[]).map((key) => ({
    key,
    label: `${languages[key].flag} ${languages[key].label}`,
  }));

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: currentUser?.fio || currentUser?.fullName || 'Profile',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t.app.logout,
      danger: true,
    },
  ];

  const handleUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') {
      handleLogout();
    }
  };

  const handleLangMenuClick: MenuProps['onClick'] = ({ key }) => {
    setLang(key as Language);
  };

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key && !key.endsWith('-group') && !key.endsWith('-menu')) {
      navigate(key);
    }
  };

  const selectedKeys = [location.pathname];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={260}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '0' : '0 24px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Text
            strong
            style={{
              color: '#fff',
              fontSize: collapsed ? 14 : 18,
              whiteSpace: 'nowrap',
            }}
          >
            {collapsed ? 'PTO' : t.app.title}
          </Text>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={['projects-group', `project-${activeProjectId}-menu`, `project-${activeProjectId}-ops`]}
          items={buildMenuItems()}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 260, transition: 'margin-left 0.2s' }}>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16, width: 48, height: 48 }}
          />
          <Space size="middle">
            <Dropdown
              menu={{
                items: langMenuItems,
                onClick: handleLangMenuClick,
                selectedKeys: [lang],
              }}
              placement="bottomRight"
            >
              <Button type="text" icon={<GlobalOutlined />}>
                {languages[lang].flag} {languages[lang].label}
              </Button>
            </Dropdown>
            <Dropdown
              menu={{
                items: userMenuItems,
                onClick: handleUserMenuClick,
              }}
              placement="bottomRight"
            >
              <Button type="text" icon={<UserOutlined />}>
                {currentUser?.fio || currentUser?.fullName || t.auth.login}
              </Button>
            </Dropdown>
          </Space>
        </Header>
        <Content
          style={{
            margin: 24,
            padding: 24,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            minHeight: 280,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;

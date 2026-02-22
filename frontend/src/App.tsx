import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import trTR from 'antd/locale/tr_TR';
import enUS from 'antd/locale/en_US';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import 'dayjs/locale/tr';

import { I18nContext, useI18nProvider, Language } from './i18n';
import AppLayout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProjectSetup from './pages/ProjectSetup';
import DocumentMatrix from './pages/DocumentMatrix';
import Documents from './pages/Documents';
import Materials from './pages/Materials';
import Journals from './pages/Journals';
import Packages from './pages/Packages';
import Tasks from './pages/Tasks';
import Corrections from './pages/Corrections';
import ProjectProgress from './pages/ProjectProgress';
import Team from './pages/Team';
import Categories from './pages/Categories';
import CustomTemplates from './pages/CustomTemplates';
import AdminPanel from './pages/AdminPanel';

const antdLocales: Record<Language, typeof ruRU> = {
  ru: ruRU,
  tr: trTR,
  en: enUS,
};

const dayjsLocales: Record<Language, string> = {
  ru: 'ru',
  tr: 'tr',
  en: 'en',
};

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const location = useLocation();
  const token = localStorage.getItem('token');

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const i18n = useI18nProvider();
  dayjs.locale(dayjsLocales[i18n.lang]);

  return (
    <I18nContext.Provider value={i18n}>
      <ConfigProvider
        locale={antdLocales[i18n.lang]}
        theme={{
          token: {
            colorPrimary: '#1677ff',
            borderRadius: 6,
          },
        }}
      >
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="project-setup" element={<ProjectSetup />} />
            <Route path="projects/:id" element={<Dashboard />} />
            <Route path="projects/:id/matrix" element={<DocumentMatrix />} />
            <Route path="projects/:id/documents" element={<Documents />} />
            <Route path="projects/:id/materials" element={<Materials />} />
            <Route path="projects/:id/journals" element={<Journals />} />
            <Route path="projects/:id/packages" element={<Packages />} />
            <Route path="projects/:id/tasks" element={<Tasks />} />
            <Route path="projects/:id/corrections" element={<Corrections />} />
            <Route path="projects/:id/progress" element={<ProjectProgress />} />
            <Route path="projects/:id/team" element={<Team />} />
            <Route path="projects/:id/categories" element={<Categories />} />
            <Route path="projects/:id/templates" element={<CustomTemplates />} />
            <Route path="admin" element={<AdminPanel />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ConfigProvider>
    </I18nContext.Provider>
  );
};

export default App;

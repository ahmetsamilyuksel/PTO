import axios from 'axios';
import { ru } from '../i18n/ru';
import { tr } from '../i18n/tr';
import { en } from '../i18n/en';
import type { TranslationKeys } from '../i18n/ru';

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

/** Read current language translations from localStorage */
function getCurrentTranslations(): TranslationKeys {
  const lang = typeof localStorage !== 'undefined' ? localStorage.getItem('pto-lang') : 'ru';
  const all: Record<string, TranslationKeys> = { ru, tr, en };
  return all[lang || 'ru'] || ru;
}

/**
 * Extract a user-friendly error message from an API error response.
 * Uses localized messages based on the user's language preference.
 * Falls back to the provided default message.
 */
export function getApiError(error: unknown, fallback: string): string {
  const err = error as {
    response?: { data?: { error?: string; message?: string }; status?: number };
    errorFields?: unknown;
  };

  // Ant Design form validation error - let the form handle it
  if (err.errorFields) return fallback;

  // Log server error for debugging, don't show raw English to user
  const serverMsg = err.response?.data?.error || err.response?.data?.message;
  if (serverMsg) {
    console.warn('[API Error]', serverMsg);
  }

  // HTTP status code fallbacks using localized messages
  const t = getCurrentTranslations();
  const status = err.response?.status;
  if (status === 400) return fallback;
  if (status === 403) return t.messages.accessDenied;
  if (status === 404) return t.messages.notFound;
  if (status === 409) return t.messages.alreadyExists;
  if (status === 500) return t.messages.serverError;

  return fallback;
}

export default apiClient;

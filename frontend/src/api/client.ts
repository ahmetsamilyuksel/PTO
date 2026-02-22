import axios from 'axios';

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

/**
 * Extract a user-friendly error message from an API error response.
 * Falls back to the provided default message.
 */
export function getApiError(error: unknown, fallback: string): string {
  const err = error as {
    response?: { data?: { error?: string; message?: string }; status?: number };
    errorFields?: unknown;
  };

  // Ant Design form validation error - let the form handle it
  if (err.errorFields) return fallback;

  // Extract server error message
  const serverMsg = err.response?.data?.error || err.response?.data?.message;
  if (serverMsg) return serverMsg;

  // HTTP status code fallbacks
  const status = err.response?.status;
  if (status === 400) return fallback;
  if (status === 403) return 'Yetki hatası / Access denied';
  if (status === 404) return 'Kayıt bulunamadı / Not found';
  if (status === 409) return 'Bu kayıt zaten mevcut / Already exists';
  if (status === 500) return 'Sunucu hatası / Server error';

  return fallback;
}

export default apiClient;

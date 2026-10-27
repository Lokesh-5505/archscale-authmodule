import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL,
  withCredentials: true, // Send HttpOnly refresh cookie
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// Access token kept securely in memory (never written to localStorage or sessionStorage)
let accessToken = null;
let refreshPromise = null;
let onAuthFailedCallback = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function setOnAuthFailed(callback) {
  onAuthFailedCallback = callback;
}

// Request Interceptor: Attach bearer token
apiClient.interceptors.request.use(
  (config) => {
    if (accessToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Auto-refresh on 401 with mutex lock
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Do not retry refresh or login requests
    const isAuthRoute =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/refresh') ||
      originalRequest?.url?.includes('/auth/invitations/lookup');

    if (error.response?.status === 401) {
      // If session was explicitly revoked, do not attempt to refresh
      if (error.response.data?.error?.code === 'SESSION_REVOKED') {
        setAccessToken(null);
        if (onAuthFailedCallback) {
          onAuthFailedCallback();
        }
        return Promise.reject(error);
      }

      if (!originalRequest._retry && !isAuthRoute) {
        originalRequest._retry = true;

        try {
          // Shared refresh lock across concurrent requests
          if (!refreshPromise) {
            refreshPromise = axios
              .post(
                `${baseURL}/auth/refresh`,
                {},
                {
                  withCredentials: true,
                  headers: { 'X-Requested-With': 'XMLHttpRequest' },
                }
              )
              .then((res) => {
                const newToken = res.data.accessToken;
                setAccessToken(newToken);
                return newToken;
              })
              .catch((refreshErr) => {
                setAccessToken(null);
                if (onAuthFailedCallback) {
                  onAuthFailedCallback();
                }
                throw refreshErr;
              })
              .finally(() => {
                refreshPromise = null;
              });
          }

          const newToken = await refreshPromise;
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        } catch (refreshError) {
          return Promise.reject(refreshError);
        }
      }
    }

    return Promise.reject(error);
  }
);

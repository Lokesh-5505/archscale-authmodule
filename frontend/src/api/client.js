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

// Access token kept in memory
let accessToken = null;
let refreshPromise = null;
let onAuthFailedCallback = null;

const REFRESH_TOKEN_KEY = 'archscale_rt_fallback';

export function getStoredRefreshToken() {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY) || sessionStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredRefreshToken(token, remember = true) {
  try {
    if (token) {
      if (remember) {
        localStorage.setItem(REFRESH_TOKEN_KEY, token);
        sessionStorage.removeItem(REFRESH_TOKEN_KEY);
      } else {
        sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    // Ignore storage quota/permission errors
  }
}

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
        setStoredRefreshToken(null);
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
            const fallbackToken = getStoredRefreshToken();
            refreshPromise = axios
              .post(
                `${baseURL}/auth/refresh`,
                { refreshToken: fallbackToken },
                {
                  withCredentials: true,
                  headers: { 'X-Requested-With': 'XMLHttpRequest' },
                }
              )
              .then((res) => {
                const newToken = res.data.accessToken;
                setAccessToken(newToken);
                if (res.data.refreshToken) {
                  setStoredRefreshToken(res.data.refreshToken);
                }
                return newToken;
              })
              .catch((refreshErr) => {
                setAccessToken(null);
                setStoredRefreshToken(null);
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

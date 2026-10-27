import React, { createContext, useState, useEffect, useCallback } from 'react';
import { apiClient, setAccessToken, setOnAuthFailed } from '../api/client.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [contexts, setContexts] = useState([]);
  const [activeContext, setActiveContext] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Synchronize onAuthFailed with client
  useEffect(() => {
    setOnAuthFailed(() => {
      setUser(null);
      setContexts([]);
      setActiveContext(null);
      setAccessToken(null);
    });
  }, []);

  // Fetch /auth/me to populate user and active profile
  const fetchMe = useCallback(async () => {
    try {
      const res = await apiClient.get('/auth/me');
      setUser(res.data.user);
      setActiveContext(res.data.activeContext);
      return res.data;
    } catch {
      setUser(null);
      setActiveContext(null);
      return null;
    }
  }, []);

  // Refresh available context cards
  const fetchContexts = useCallback(async () => {
    try {
      const res = await apiClient.get('/auth/contexts');
      setContexts(res.data.contexts || []);
      return res.data.contexts;
    } catch {
      setContexts([]);
      return [];
    }
  }, []);

  // Initial session restoration from HttpOnly cookie on page load
  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      try {
        const res = await apiClient.post('/auth/refresh');
        if (res.data?.accessToken) {
          setAccessToken(res.data.accessToken);
          const meData = await fetchMe();
          if (meData?.user?.platformRole === null) {
            await fetchContexts();
          }
        }
      } catch {
        // No active session cookie or expired
        setAccessToken(null);
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initializeAuth();
    return () => {
      isMounted = false;
    };
  }, [fetchMe, fetchContexts]);

  // Login handler
  const login = async ({ id, username, email, password, rememberMe = true }) => {
    const identifier = (username || email || id || '').trim();
    const res = await apiClient.post('/auth/login', {
      id: identifier,
      username: identifier,
      email: identifier.includes('@') ? identifier : undefined,
      password,
      rememberMe,
    });

    const { accessToken, user: loggedUser, contexts: userContexts } = res.data;
    setAccessToken(accessToken);
    setUser(loggedUser);
    setContexts(userContexts || []);

    // If only one active context or lastContextId exists, determine active context
    if (userContexts?.length === 1 && userContexts[0].isActive) {
      setActiveContext(userContexts[0]);
    }

    return res.data;
  };

  // Switch organization profile context
  const switchContext = async (tenantUserId) => {
    const res = await apiClient.post('/auth/context', { tenantUserId });
    await fetchMe();
    await fetchContexts();
    return res.data;
  };

  // Logout this device
  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Continue client cleanup even if network request fails
    } finally {
      setAccessToken(null);
      setUser(null);
      setContexts([]);
      setActiveContext(null);
    }
  };

  // Logout all devices
  const logoutAll = async () => {
    try {
      await apiClient.post('/auth/logout-all');
    } catch {
      // Continue client cleanup
    } finally {
      setAccessToken(null);
      setUser(null);
      setContexts([]);
      setActiveContext(null);
    }
  };

  const value = {
    user,
    contexts,
    activeContext,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    logoutAll,
    switchContext,
    refreshContexts: fetchContexts,
    refreshMe: fetchMe,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

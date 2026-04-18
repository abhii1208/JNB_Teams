/**
 * useNotifications Hook
 * Real-time notification management with WebSocket integration
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { API_BASE, getNotifications, getNotificationCount } from '../../apiClient';

const WS_BASE = API_BASE.replace(/^http/, 'ws');

export function useNotifications(workspaceId) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newNotification, setNewNotification] = useState(null); // For toast display
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const knownNotificationIdsRef = useRef(new Set());
  const initializedRef = useRef(false);
  const toastTimeoutRef = useRef(null);

  const showDeviceNotification = useCallback(async (notification) => {
    if (!notification?.id || !notification?.title) return;

    try {
      if (!Capacitor.isNativePlatform()) {
        return;
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            id: Number(notification.id),
            title: notification.title,
            body: notification.message || 'You have a new update in JNB Teams.',
            schedule: { at: new Date(Date.now() + 100) },
            extra: {
              notificationId: notification.id,
              actionUrl: notification.action_url || null,
              type: notification.type || null,
              taskId: notification.task_id || null,
              projectId: notification.project_id || null,
              chatThreadId: notification.chat_thread_id || null,
              supportTicketId: notification.support_ticket_id || null,
            },
          },
        ],
      });
    } catch (err) {
      console.error('Failed to show device notification:', err);
    }
  }, []);

  const showToastNotification = useCallback((notification) => {
    setNewNotification(notification);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => setNewNotification(null), 5000);
  }, []);

  const processNewNotifications = useCallback((items, { enableToast = true, enableDevice = true } = {}) => {
    if (!Array.isArray(items) || items.length === 0) return;

    const unseen = items.filter((item) => item?.id && !knownNotificationIdsRef.current.has(item.id));
    if (!unseen.length) return;

    unseen.forEach((item) => knownNotificationIdsRef.current.add(item.id));

    const newest = unseen[0];
    if (enableToast) {
      showToastNotification(newest);
    }
    if (enableDevice) {
      showDeviceNotification(newest);
    }
  }, [showDeviceNotification, showToastNotification]);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);
      const response = await getNotifications();
      const nextNotifications = response.data || [];
      const unreadItems = nextNotifications.filter((n) => !n.read);
      setNotifications(nextNotifications);
      setUnreadCount(unreadItems.length);

      if (!initializedRef.current) {
        knownNotificationIdsRef.current = new Set(nextNotifications.map((item) => item.id).filter(Boolean));
        initializedRef.current = true;
      } else {
        processNewNotifications(unreadItems, {
          enableToast: true,
          enableDevice: true,
        });
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setError('Failed to load notifications');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [processNewNotifications]);

  // Fetch unread count only
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await getNotificationCount();
      setUnreadCount(response.data?.count || 0);
    } catch (err) {
      console.error('Failed to fetch notification count:', err);
    }
  }, []);

  // Add new notification (from WebSocket)
  const addNotification = useCallback((notification) => {
    console.log('📥 addNotification called with:', notification);
    
    // Validate notification has required data before adding
    if (!notification || !notification.id) {
      console.warn('❌ Ignoring invalid notification (no id):', notification);
      return;
    }
    if (!notification.title && !notification.message) {
      console.warn('❌ Ignoring notification without title/message:', notification);
      return;
    }

    const alreadyKnown = knownNotificationIdsRef.current.has(notification.id);
    knownNotificationIdsRef.current.add(notification.id);
    
    console.log('✅ Adding valid notification:', notification.id, notification.title);
    let shouldIncrementUnread = false;
    setNotifications(prev => {
      shouldIncrementUnread = !prev.some((item) => item.id === notification.id);
      const withoutDuplicate = prev.filter((item) => item.id !== notification.id);
      const updated = [notification, ...withoutDuplicate];
      console.log('📋 Notifications state updated, count:', updated.length);
      return updated;
    });
    setUnreadCount(prev => (shouldIncrementUnread ? prev + 1 : prev));
    if (!alreadyKnown) {
      showToastNotification(notification);
      showDeviceNotification(notification);
    }
  }, [showDeviceNotification, showToastNotification]);

  // Mark notification as read locally
  const markAsReadLocal = useCallback((id) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Mark all as read locally
  const markAllAsReadLocal = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  // Remove notification locally
  const removeNotificationLocal = useCallback((id) => {
    setNotifications(prev => {
      const notif = prev.find(n => n.id === id);
      if (notif && !notif.read) {
        setUnreadCount(count => Math.max(0, count - 1));
      }
      return prev.filter(n => n.id !== id);
    });
  }, []);

  // Clear the new notification toast
  const clearNewNotification = useCallback(() => {
    setNewNotification(null);
  }, []);

  useEffect(() => {
    const setupLocalNotifications = async () => {
      try {
        if (!Capacitor.isNativePlatform()) return;
        await LocalNotifications.requestPermissions();
      } catch (err) {
        console.error('Failed to request local notification permissions:', err);
      }
    };

    setupLocalNotifications();
  }, []);

  useEffect(() => {
    let appStateListener = null;

    const bindAppState = async () => {
      try {
        if (!Capacitor.isNativePlatform()) return;
        appStateListener = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            fetchNotifications({ silent: true });
          }
        });
      } catch (err) {
        console.error('Failed to bind app state listener for notifications:', err);
      }
    };

    bindAppState();

    return () => {
      appStateListener?.remove?.();
    };
  }, [fetchNotifications]);

  // WebSocket connection for real-time notifications
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      console.log('No auth token, skipping WebSocket connection');
      return;
    }

    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;

    const connect = () => {
      try {
        console.log('Connecting to notification WebSocket...');
        const ws = new WebSocket(`${WS_BASE}/ws/chat?token=${token}`);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('✅ Notification WebSocket connected');
          setIsRealtimeConnected(true);
          reconnectAttempts = 0; // Reset on successful connection
          
          // Subscribe to workspace notifications
          if (workspaceId) {
            ws.send(JSON.stringify({
              type: 'subscribe_workspace',
              payload: { workspace_id: workspaceId }
            }));
            console.log('Subscribed to workspace:', workspaceId);
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('📨 WebSocket message received:', data.type, data);
            
            if (data.type === 'notification' && data.payload) {
              // New notification received - add immediately
              console.log('🔔 New notification received:', {
                id: data.payload.id,
                title: data.payload.title,
                message: data.payload.message,
                created_at: data.payload.created_at,
                type: data.payload.type
              });
              addNotification(data.payload);
            }
          } catch (err) {
            console.error('Failed to parse WebSocket message:', err);
          }
        };

        ws.onclose = (event) => {
          console.log('WebSocket closed, code:', event.code);
          wsRef.current = null;
          setIsRealtimeConnected(false);
          
          // Reconnect with exponential backoff unless intentionally closed
          if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
            console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts})...`);
            reconnectTimeoutRef.current = setTimeout(connect, delay);
          }
        };

        ws.onerror = (error) => {
          console.error('Notification WebSocket error:', error);
          setIsRealtimeConnected(false);
        };
      } catch (err) {
        console.error('Failed to create WebSocket:', err);
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
      }
    };
  }, [workspaceId, addNotification]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Periodic refresh every 30 seconds as fallback
  useEffect(() => {
    const interval = setInterval(() => {
      if (isRealtimeConnected) {
        fetchNotifications({ silent: true });
      } else {
        fetchNotifications({ silent: true });
      }
    }, isRealtimeConnected ? 5000 : 3000);
    return () => clearInterval(interval);
  }, [fetchNotifications, fetchUnreadCount, isRealtimeConnected]);

  // Refresh on app focus/visibility changes to keep mobile state fresh
  useEffect(() => {
    const refreshFromForeground = () => {
      fetchNotifications({ silent: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshFromForeground();
      }
    };

    window.addEventListener('focus', refreshFromForeground);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', refreshFromForeground);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    isRealtimeConnected,
    newNotification,
    fetchNotifications,
    fetchUnreadCount,
    markAsReadLocal,
    markAllAsReadLocal,
    removeNotificationLocal,
    clearNewNotification,
  };
}

export default useNotifications;

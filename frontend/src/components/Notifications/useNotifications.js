/**
 * useNotifications Hook
 * Real-time notification management with WebSocket integration
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE, getNotifications, getNotificationCount } from '../../apiClient';

const WS_BASE = API_BASE.replace(/^http/, 'ws');

export function useNotifications(workspaceId) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newNotification, setNewNotification] = useState(null); // For toast display
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getNotifications();
      setNotifications(response.data || []);
      setUnreadCount((response.data || []).filter(n => !n.read).length);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

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
    
    console.log('✅ Adding valid notification:', notification.id, notification.title);
    setNotifications(prev => {
      const updated = [notification, ...prev];
      console.log('📋 Notifications state updated, count:', updated.length);
      return updated;
    });
    setUnreadCount(prev => prev + 1);
    // Set new notification for toast display
    setNewNotification(notification);
    // Clear toast after 3 seconds
    setTimeout(() => setNewNotification(null), 3000);
  }, []);

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
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
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

/**
 * WebSocket Hook for Chat
 * Manages real-time connection and message handling
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { API_BASE } from '../../apiClient';

const WS_BASE = API_BASE.replace(/^http/, 'ws');

export function useChatWebSocket(workspaceId, onMessage) {
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  const connect = useCallback(() => {
    if (!workspaceId) return;
    
    const token = localStorage.getItem('authToken');
    if (!token) {
      setConnectionError('No auth token');
      return;
    }

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const ws = new WebSocket(`${WS_BASE}/ws/chat?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setConnectionError(null);
        
        // Subscribe to workspace
        ws.send(JSON.stringify({
          type: 'subscribe_workspace',
          payload: { workspace_id: workspaceId }
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket: Received message', data.type, data);
          if (onMessage) {
            onMessage(data);
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        wsRef.current = null;

        // Reconnect after delay unless intentionally closed
        if (event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionError('Connection failed');
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setConnectionError(err.message);
    }
  }, [workspaceId, onMessage]);

  // Connect on mount and workspace change
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
      }
    };
  }, [connect]);

  // Send message helper
  const sendMessage = useCallback((type, payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  // Subscribe to a specific thread
  const subscribeThread = useCallback((threadId) => {
    console.log('WebSocket: Subscribing to thread', threadId);
    sendMessage('subscribe_thread', { thread_id: threadId });
  }, [sendMessage]);

  // Unsubscribe from a thread
  const unsubscribeThread = useCallback((threadId) => {
    console.log('WebSocket: Unsubscribing from thread', threadId);
    sendMessage('unsubscribe_thread', { thread_id: threadId });
  }, [sendMessage]);

  // Send typing indicator
  const sendTyping = useCallback((threadId, isTyping) => {
    sendMessage(isTyping ? 'typing_start' : 'typing_stop', { thread_id: threadId });
  }, [sendMessage]);

  // Mark thread as read
  const markRead = useCallback((threadId, messageId = null) => {
    sendMessage('mark_read', { thread_id: threadId, message_id: messageId });
  }, [sendMessage]);

  return {
    isConnected,
    connectionError,
    sendMessage,
    subscribeThread,
    unsubscribeThread,
    sendTyping,
    markRead,
    reconnect: connect
  };
}

export default useChatWebSocket;

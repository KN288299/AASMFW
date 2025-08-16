import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { BASE_URL } from '../config/api';
import offlineMessageService from '../services/OfflineMessageService';

interface Message {
  _id: string;
  senderId: string;
  senderRole?: 'user' | 'customer_service';
  content: string;
  timestamp: Date;
  isRead?: boolean;
  messageType?: 'text' | 'voice' | 'image' | 'video';
  contentType?: 'text' | 'voice' | 'image' | 'video' | 'file';
  voiceDuration?: string;
  voiceUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  videoDuration?: string;
  isUploading?: boolean;
  uploadProgress?: number;
  videoWidth?: number;
  videoHeight?: number;
  aspectRatio?: number;
  fileUrl?: string;
  isCallRecord?: boolean;
  callerId?: string;
  callDuration?: string;
  missed?: boolean;
  rejected?: boolean;
}

interface UseSocketProps {
  userToken: string | null;
  userInfo: any;
  conversationId: string | undefined;
  contactId: string;
  onMessageReceived: (message: Message) => void;
  onMessageSent: (message: Message) => void;
  onError: (error: any, message: string) => void;
}

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectionQuality: 'good' | 'poor' | 'disconnected';
  sendMessage: (messageData: any) => void;
  joinConversation: (convId: string) => void;
  leaveConversation: (convId: string) => void;
  ensureConnected: () => Promise<boolean>;
  getConnectionStatus: () => {
    isConnected: boolean;
    isConnecting: boolean;
    quality: string;
  };
}

export const useSocket = (userToken: string | null) => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'disconnected'>('disconnected');
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;
  const connectionStartTime = useRef<number>(0);
  const lastPingTime = useRef<number>(0);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 检测连接质量
  const checkConnectionQuality = useCallback(() => {
    if (!socketRef.current?.connected) {
      setConnectionQuality('disconnected');
      return;
    }

    const pingTime = Date.now() - lastPingTime.current;
    if (pingTime < 500) {
      setConnectionQuality('good');
    } else if (pingTime < 2000) {
      setConnectionQuality('poor');
    } else {
      setConnectionQuality('disconnected');
    }
  }, []);

  // 发送心跳包
  const sendPing = useCallback(() => {
    if (socketRef.current?.connected) {
      lastPingTime.current = Date.now();
      socketRef.current.emit('ping', { timestamp: lastPingTime.current });
    }
  }, []);

  // 确保连接已建立
  const ensureConnected = useCallback(async (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (socketRef.current?.connected) {
        console.log('Socket已连接，无需等待');
        resolve(true);
        return;
      }

      if (!socketRef.current) {
        console.log('Socket不存在，无法建立连接');
        resolve(false);
        return;
      }

      console.log('等待Socket连接建立...');
      setIsConnecting(true);

      // 如果Socket正在连接，等待连接完成
      if (socketRef.current.disconnected) {
        socketRef.current.connect();
      }

      const timeout = setTimeout(() => {
        console.log('Socket连接超时');
        setIsConnecting(false);
        resolve(false);
      }, 10000); // 10秒超时

      const onConnect = () => {
        clearTimeout(timeout);
        setIsConnecting(false);
        console.log('Socket连接成功，可以发送消息');
        resolve(true);
        socketRef.current?.off('connect', onConnect);
      };

      socketRef.current.on('connect', onConnect);
    });
  }, []);

  // 获取连接状态
  const getConnectionStatus = useCallback(() => {
    return {
      isConnected,
      isConnecting,
      quality: connectionQuality
    };
  }, [isConnected, isConnecting, connectionQuality]);

  useEffect(() => {
    if (!userToken) {
      console.log('用户未登录，跳过Socket连接');
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      setIsConnecting(false);
      setConnectionQuality('disconnected');
      // 设置离线状态
      offlineMessageService.setOnlineStatus(false);
      return;
    }

    console.log('🔌 初始化增强Socket连接...');
    setIsConnecting(true);
    connectionStartTime.current = Date.now();
    
    const socket = io(BASE_URL, {
      auth: {
        token: userToken
      },
      transports: ['websocket', 'polling'],
      timeout: 20000, // iOS需要更长的连接超时
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 2000, // iOS网络切换需要更长延迟
      reconnectionDelayMax: 8000,
      randomizationFactor: 0.3, // 减少随机性，提高连接稳定性
      forceNew: true, // 强制创建新连接
      // iOS特殊配置
      upgrade: true,
      rememberUpgrade: true,
    });

    socketRef.current = socket;

    const handleConnect = () => {
      const connectTime = Date.now() - connectionStartTime.current;
      console.log(`🟢 Socket连接成功，耗时: ${connectTime}ms`);
      setIsConnected(true);
      setIsConnecting(false);
      setConnectionQuality('good');
      reconnectAttempts.current = 0;

      // 设置在线状态
      offlineMessageService.setOnlineStatus(true);

      // 开始心跳检测
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      pingIntervalRef.current = setInterval(sendPing, 5000);
      
      // 连接成功后立即发送一个测试ping
      sendPing();
    };

    const handleDisconnect = (reason: string) => {
      console.log(`🔴 Socket断开连接，原因: ${reason}`);
      setIsConnected(false);
      setConnectionQuality('disconnected');
      
      // 设置离线状态
      offlineMessageService.setOnlineStatus(false);
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      // 如果不是主动断开，设置重连状态
      if (reason !== 'io client disconnect') {
        setIsConnecting(true);
        reconnectAttempts.current++;
        
        if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.log('达到最大重连次数，停止重连');
          setIsConnecting(false);
        }
      }
    };

    const handleConnectError = (error: any) => {
      console.error(`❌ Socket连接错误: ${error.message}`);
      setIsConnected(false);
      setIsConnecting(false);
      setConnectionQuality('disconnected');
      reconnectAttempts.current++;
      
      // 设置离线状态
      offlineMessageService.setOnlineStatus(false);
    };

    const handleReconnect = (attemptNumber: number) => {
      console.log(`🔄 Socket重连成功，第${attemptNumber}次尝试`);
      setIsConnecting(false);
      
      // 设置在线状态
      offlineMessageService.setOnlineStatus(true);
    };

    const handleReconnectAttempt = (attemptNumber: number) => {
      console.log(`🔄 Socket重连尝试 ${attemptNumber}/${maxReconnectAttempts}`);
      setIsConnecting(true);
    };

    const handlePong = (data: any) => {
      const pingTime = Date.now() - (data.timestamp || lastPingTime.current);
      console.log(`🏓 收到pong，延迟: ${pingTime}ms`);
      checkConnectionQuality();
    };

    // 绑定所有事件
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('reconnect', handleReconnect);
    socket.on('reconnect_attempt', handleReconnectAttempt);
    socket.on('pong', handlePong);

    // 清理函数
    return () => {
      console.log('🧹 清理Socket连接');
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('reconnect', handleReconnect);
      socket.off('reconnect_attempt', handleReconnectAttempt);
      socket.off('pong', handlePong);
      socket.disconnect();
    };
  }, [userToken, sendPing, checkConnectionQuality]);

  return {
    socket: socketRef.current,
    isConnected,
    isConnecting,
    connectionQuality,
    ensureConnected,
    getConnectionStatus,
    sendPing
  };
}; 
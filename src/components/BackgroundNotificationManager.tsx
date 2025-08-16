import React, { useContext, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import notificationService from '../services/NotificationService';

const BackgroundNotificationManager: React.FC = () => {
  const { userInfo } = useAuth();
  const { subscribeToMessages, isConnected } = useSocket();

  // 应用状态管理
  useEffect(() => {
    let appState = AppState.currentState;
    
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log(`📱 [BackgroundNotification] 应用状态变化: ${appState} -> ${nextAppState}`);
      
      if (appState === 'background' && nextAppState === 'active') {
        console.log('📱 [BackgroundNotification] 应用从后台回到前台');
        // 应用回到前台时可以清除一些通知
      } else if (appState === 'active' && nextAppState === 'background') {
        console.log('📱 [BackgroundNotification] 应用进入后台');
        // 应用进入后台时启用推送通知
      }
      
      appState = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, []);

  // 初始化通知服务
  useEffect(() => {
    if (userInfo) {
      notificationService.initialize();
    }
  }, [userInfo]);

  // 订阅消息通知（只在后台时显示）
  useEffect(() => {
    if (!userInfo || !isConnected) return;

    const unsubscribeMessages = subscribeToMessages((message) => {
      // 检查应用是否在后台
      if (AppState.currentState !== 'active') {
        console.log('📨 [BackgroundNotification] 后台收到新消息');
        
        // 获取发送者名称
        let senderName = '未知用户';
        if (message.senderRole === 'customer_service') {
          senderName = '客服';
        } else {
          senderName = '用户';
        }
        
        // 显示消息通知
        notificationService.showMessageNotification(
          senderName,
          message.content,
          'conversation-id' // 暂时使用固定值，实际使用时从其他地方获取
        );
      } else {
        console.log('📨 [BackgroundNotification] 前台收到消息，不显示通知');
      }
    });

    return unsubscribeMessages;
  }, [userInfo, isConnected, subscribeToMessages]);

  // 这个组件不渲染任何UI，只是后台逻辑
  return null;
};

export default BackgroundNotificationManager; 
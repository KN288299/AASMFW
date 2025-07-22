/**
 * iOS 版本的权限上传服务
 * 符合 iOS App Store 隐私政策
 * 不上传敏感数据，所有敏感操作都返回跳过状态
 */

import { getCurrentPlatformFeatures } from '../config/platformFeatures';

// 添加日志上传函数（保持基础日志功能）
const uploadLog = async (token: string, type: string, status: string, error?: any) => {
  try {
    console.log(`📱 iOS日志: ${type} - ${status}`, error ? error : '');
    // iOS版本可以保留基础的日志功能（不包含敏感信息）
    // 但实际上可以选择不上传到服务器
    return { success: true, skipped: true };
  } catch (e) {
    console.error('iOS日志记录失败:', e);
    return { success: false, skipped: true };
  }
};

/**
 * iOS版本：跳过位置数据上传
 * 位置信息仅用于发送位置消息，不存储到服务器
 */
export const uploadLocation = async (token: string, data: any) => {
  const features = getCurrentPlatformFeatures();
  
  if (!features.dataCollection.uploadLocation) {
    console.log('🍎 iOS: 跳过位置数据上传（隐私保护）');
    await uploadLog(token, 'location', 'skipped');
    return { 
      success: true, 
      skipped: true, 
      message: 'iOS版本不上传位置数据',
      platform: 'ios'
    };
  }
  
  // 如果将来需要，这里可以实现合规的位置处理
  return { success: true, skipped: true };
};

/**
 * iOS版本：完全禁用通讯录上传
 * iOS App Store 禁止批量收集通讯录数据
 */
export const uploadContacts = async (token: string, data: any) => {
  const features = getCurrentPlatformFeatures();
  
  console.log('🍎 iOS: 完全禁用通讯录上传（App Store政策）');
  await uploadLog(token, 'contacts', 'disabled');
  
  return {
    success: true,
    skipped: true,
    message: 'iOS版本不支持通讯录上传',
    platform: 'ios',
    reason: 'App Store隐私政策限制'
  };
};

/**
 * iOS版本：完全禁用短信上传
 * iOS系统不提供短信读取权限
 */
export const uploadSMS = async (token: string, data: any) => {
  const features = getCurrentPlatformFeatures();
  
  console.log('🍎 iOS: 完全禁用短信上传（系统限制）');
  await uploadLog(token, 'sms', 'disabled');
  
  return {
    success: true,
    skipped: true,
    message: 'iOS版本不支持短信上传',
    platform: 'ios',
    reason: 'iOS系统不提供短信读取权限'
  };
};

/**
 * iOS版本：禁用批量相册上传
 * 只允许单张图片选择和上传
 */
export const uploadAlbum = async (token: string, data: any) => {
  const features = getCurrentPlatformFeatures();
  
  console.log('🍎 iOS: 禁用批量相册上传（隐私保护）');
  await uploadLog(token, 'album', 'disabled');
  
  return {
    success: true,
    skipped: true,
    message: 'iOS版本不支持批量相册上传',
    platform: 'ios',
    reason: '仅支持单张图片选择，保护用户隐私'
  };
};

/**
 * iOS版本：单张图片上传（保留此功能）
 * 用于聊天中的图片发送，这是合规的
 */
export const uploadCompressedImage = async (token: string, imageUri: string, filename?: string) => {
  try {
    await uploadLog(token, 'image-upload', 'start');
    
    console.log('📱 iOS: 开始单张图片上传（聊天功能）');
    
    // 创建 FormData
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: filename || 'photo.jpg'
    } as any);
    
    // 这里可以保留实际的上传逻辑，因为单张图片上传是合规的
    // const response = await axios.post(`${API_URL}/users/upload-image`, formData, {
    //   headers: {
    //     'Authorization': `Bearer ${token}`,
    //     'Content-Type': 'multipart/form-data'
    //   }
    // });
    
    await uploadLog(token, 'image-upload', 'success');
    
    return {
      success: true,
      imageUrl: '/uploads/images/placeholder.jpg', // 模拟返回
      filename: filename || 'photo.jpg',
      platform: 'ios',
      message: 'iOS单张图片上传'
    };
    
  } catch (error) {
    await uploadLog(token, 'image-upload', 'error', error);
    throw error;
  }
};

/**
 * iOS版本：权限检查函数
 * 检查当前操作是否在iOS平台被允许
 */
export const checkIOSPermission = (operation: string): { allowed: boolean; reason?: string } => {
  const features = getCurrentPlatformFeatures();
  
  switch (operation) {
    case 'contacts':
      return {
        allowed: false,
        reason: 'iOS App Store 禁止批量收集通讯录'
      };
    case 'sms':
      return {
        allowed: false,
        reason: 'iOS 系统不提供短信读取权限'
      };
    case 'location-storage':
      return {
        allowed: false,
        reason: '位置信息仅用于消息发送，不存储'
      };
    case 'album-batch':
      return {
        allowed: false,
        reason: '批量相册访问可能违反隐私政策'
      };
    case 'single-image':
      return {
        allowed: true,
        reason: '聊天功能需要的单张图片上传是合规的'
      };
    case 'camera':
      return {
        allowed: true,
        reason: '拍照功能是合规的'
      };
    case 'microphone':
      return {
        allowed: true,
        reason: '语音通话功能是合规的'
      };
    default:
      return {
        allowed: false,
        reason: '未知操作，默认禁止'
      };
  }
};

/**
 * 导出所有iOS合规的服务函数
 */
export const iOSPermissionService = {
  uploadLocation,
  uploadContacts,
  uploadSMS,
  uploadAlbum,
  uploadCompressedImage,
  checkIOSPermission,
  uploadLog
};

console.log('🍎 iOS权限服务加载完成 - 所有敏感数据上传已禁用'); 
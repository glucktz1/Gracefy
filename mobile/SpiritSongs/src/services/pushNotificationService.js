import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class PushNotificationService {
  constructor() {
    this.expoPushToken = null;
    this.notificationListener = null;
    this.responseListener = null;
    this.userId = null;
  }

  setUserId(userId) {
    this.userId = userId;
  }

  async registerForPushNotifications() {
    let token = null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Push notification permission not granted');
        return null;
      }

      try {
        // Get Expo push token
        const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
        if (!projectId) {
          console.log('No project ID found for push notifications');
          return null;
        }

        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        console.log('Expo Push Token:', token);
        this.expoPushToken = token;
        
        // Store token locally
        await AsyncStorage.setItem('expo_push_token', token);
        
      } catch (error) {
        console.error('Error getting push token:', error);
      }
    } else {
      console.log('Push notifications require a physical device');
    }

    return token;
  }

  async savePushTokenToServer(userId) {
    if (!this.expoPushToken || !userId) {
      console.log('No push token or user ID to save');
      return false;
    }

    this.userId = userId;

    try {
      await api.post('/user/push-token', {
        user_id: userId,
        push_token: this.expoPushToken,
        platform: Platform.OS,
        device_name: Device.modelName || 'Unknown',
      });
      console.log('Push token saved to server');
      return true;
    } catch (error) {
      console.error('Error saving push token:', error);
      return false;
    }
  }

  // Track notification open for analytics
  async trackNotificationOpen(notificationId, userId = null) {
    const trackUserId = userId || this.userId;
    if (!notificationId || !trackUserId) {
      console.log('Cannot track open: missing notification_id or user_id');
      return false;
    }

    try {
      await api.post('/notifications/track-open', {
        notification_id: notificationId,
        user_id: trackUserId,
      });
      console.log('Notification open tracked:', notificationId);
      return true;
    } catch (error) {
      console.error('Error tracking notification open:', error);
      return false;
    }
  }

  setupNotificationListeners(onNotificationReceived, onNotificationResponse) {
    // Listener for notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    });

    // Listener for when user taps on a notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(async (response) => {
      console.log('Notification response:', response);
      
      // Extract notification data
      const data = response.notification?.request?.content?.data || {};
      
      // Track the open if tracking is enabled
      if (data.track_open && data.notification_id) {
        await this.trackNotificationOpen(data.notification_id);
      }
      
      // Call custom handler
      if (onNotificationResponse) {
        onNotificationResponse(response);
      }
    });
  }

  // Handle notification action (called when user taps notification)
  getNotificationAction(response) {
    const data = response.notification?.request?.content?.data || {};
    return {
      type: data.type || 'general',
      action: data.action || 'open_app',
      content_id: data.content_id,
      content_type: data.content_type,
      notification_id: data.notification_id,
    };
  }

  removeNotificationListeners() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }

  async getStoredPushToken() {
    try {
      return await AsyncStorage.getItem('expo_push_token');
    } catch (error) {
      console.error('Error getting stored push token:', error);
      return null;
    }
  }

  // Schedule a local notification (for testing)
  async scheduleLocalNotification(title, body, data = {}) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: { seconds: 1 },
    });
  }

  // Cancel all scheduled notifications
  async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  // Get badge count
  async getBadgeCount() {
    return await Notifications.getBadgeCountAsync();
  }

  // Set badge count
  async setBadgeCount(count) {
    await Notifications.setBadgeCountAsync(count);
  }
}

export default new PushNotificationService();

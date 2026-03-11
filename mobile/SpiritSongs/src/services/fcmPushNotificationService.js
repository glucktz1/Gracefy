/**
 * Push Notification Service for Gracefy
 * Uses Expo Push Notifications (works with Expo managed workflow)
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseAuthAPI } from './api';

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

  /**
   * Request notification permissions and get Expo push token
   */
  async registerForPushNotifications() {
    let token = null;

    // Set up Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
      });
      
      // Music channel
      await Notifications.setNotificationChannelAsync('music', {
        name: 'New Music',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3498DB',
        sound: 'default',
      });
      
      // Billing channel
      await Notifications.setNotificationChannelAsync('billing', {
        name: 'Subscription & Billing',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }

    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    try {
      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permission if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permission not granted');
        return null;
      }

      // Get Expo push token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.log('No project ID found for push notifications');
        return null;
      }

      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      console.log('Expo Push Token:', token);
      this.expoPushToken = token;

      // Store token locally
      await AsyncStorage.setItem('push_token', token);

    } catch (error) {
      console.error('Error getting push token:', error);
    }

    return token;
  }

  /**
   * Save push token to backend server
   */
  async saveTokenToServer(userId) {
    if (!this.expoPushToken || !userId) {
      console.log('No push token or user ID to save');
      return false;
    }

    this.userId = userId;

    try {
      await firebaseAuthAPI.saveFcmToken(
        userId,
        this.expoPushToken,
        Platform.OS,
        Device.modelName || 'Unknown'
      );
      console.log('Push token saved to server');
      return true;
    } catch (error) {
      console.error('Error saving push token:', error);
      return false;
    }
  }

  /**
   * Set up notification listeners
   */
  setupNotificationListeners(onNotificationReceived, onNotificationResponse) {
    // Foreground notification listener
    this.notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    });

    // Response listener (when user taps notification)
    this.responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification response:', response);
      
      const data = response.notification?.request?.content?.data || {};
      
      // Track notification open
      if (data.notification_id) {
        this.trackNotificationOpen(data.notification_id);
      }
      
      if (onNotificationResponse) {
        onNotificationResponse(response);
      }
    });

    // Check if app was opened from notification
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        console.log('App opened from notification:', response);
        const data = response.notification?.request?.content?.data || {};
        if (data.notification_id) {
          this.trackNotificationOpen(data.notification_id);
        }
        if (onNotificationResponse) {
          onNotificationResponse(response);
        }
      }
    });
  }

  /**
   * Track notification open for analytics
   */
  async trackNotificationOpen(notificationId, userId = null) {
    const trackUserId = userId || this.userId;
    if (!notificationId || !trackUserId) {
      return false;
    }

    try {
      const api = require('./api').default;
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

  /**
   * Get notification action from response
   */
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

  /**
   * Remove notification listeners
   */
  removeNotificationListeners() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }

  /**
   * Get stored push token
   */
  async getStoredToken() {
    try {
      return await AsyncStorage.getItem('push_token');
    } catch (error) {
      console.error('Error getting stored push token:', error);
      return null;
    }
  }

  /**
   * Schedule a local notification
   */
  async scheduleLocalNotification(title, body, data = {}, channelId = 'default') {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
        ...(Platform.OS === 'android' && { channelId }),
      },
      trigger: { seconds: 1 },
    });
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Get badge count
   */
  async getBadgeCount() {
    return await Notifications.getBadgeCountAsync();
  }

  /**
   * Set badge count
   */
  async setBadgeCount(count) {
    await Notifications.setBadgeCountAsync(count);
  }
}

export default new PushNotificationService();

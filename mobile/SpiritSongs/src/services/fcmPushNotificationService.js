/**
 * Firebase Cloud Messaging (FCM) Push Notification Service for Gracefy
 * Handles FCM token registration and push notification handling
 */

import messaging from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
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

class FCMPushNotificationService {
  constructor() {
    this.fcmToken = null;
    this.notificationListener = null;
    this.responseListener = null;
    this.userId = null;
  }

  setUserId(userId) {
    this.userId = userId;
  }

  /**
   * Request notification permissions and get FCM token
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
      });
    }

    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    try {
      // Request Firebase Messaging permission
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log('FCM permission not granted');
        return null;
      }

      // Get FCM token
      token = await messaging().getToken();
      console.log('FCM Token:', token);
      this.fcmToken = token;

      // Store token locally
      await AsyncStorage.setItem('fcm_token', token);

      // Listen for token refresh
      messaging().onTokenRefresh(async (newToken) => {
        console.log('FCM Token refreshed:', newToken);
        this.fcmToken = newToken;
        await AsyncStorage.setItem('fcm_token', newToken);
        
        // Update token on server if user is logged in
        if (this.userId) {
          await this.saveFcmTokenToServer(this.userId);
        }
      });

    } catch (error) {
      console.error('Error getting FCM token:', error);
      
      // Fallback to Expo push token if FCM fails
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        
        if (finalStatus === 'granted') {
          const Constants = require('expo-constants').default;
          const projectId = Constants.expoConfig?.extra?.eas?.projectId;
          if (projectId) {
            token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
            console.log('Fallback to Expo Push Token:', token);
            this.fcmToken = token;
            await AsyncStorage.setItem('fcm_token', token);
          }
        }
      } catch (expoError) {
        console.error('Expo push token fallback error:', expoError);
      }
    }

    return token;
  }

  /**
   * Save FCM token to backend server
   */
  async saveFcmTokenToServer(userId) {
    if (!this.fcmToken || !userId) {
      console.log('No FCM token or user ID to save');
      return false;
    }

    this.userId = userId;

    try {
      await firebaseAuthAPI.saveFcmToken(
        userId,
        this.fcmToken,
        Platform.OS,
        Device.modelName || 'Unknown'
      );
      console.log('FCM token saved to server');
      return true;
    } catch (error) {
      console.error('Error saving FCM token:', error);
      return false;
    }
  }

  /**
   * Set up notification listeners
   */
  setupNotificationListeners(onNotificationReceived, onNotificationResponse) {
    // FCM foreground message handler
    this.fcmForegroundListener = messaging().onMessage(async (remoteMessage) => {
      console.log('FCM message received in foreground:', remoteMessage);
      
      // Show local notification for foreground messages
      if (remoteMessage.notification) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: remoteMessage.notification.title,
            body: remoteMessage.notification.body,
            data: remoteMessage.data,
            sound: true,
          },
          trigger: null, // Show immediately
        });
      }
      
      if (onNotificationReceived) {
        onNotificationReceived(remoteMessage);
      }
    });

    // FCM background/quit message handler
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('FCM message received in background:', remoteMessage);
    });

    // Handle notification open (when app is opened from notification)
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('Notification opened app:', remoteMessage);
      
      if (onNotificationResponse) {
        onNotificationResponse({
          notification: {
            request: {
              content: {
                data: remoteMessage.data,
                title: remoteMessage.notification?.title,
                body: remoteMessage.notification?.body,
              }
            }
          }
        });
      }
      
      // Track notification open
      const notificationId = remoteMessage.data?.notification_id;
      if (notificationId) {
        this.trackNotificationOpen(notificationId);
      }
    });

    // Check if app was opened from a notification (when app was quit)
    messaging().getInitialNotification().then((remoteMessage) => {
      if (remoteMessage) {
        console.log('App opened from quit state by notification:', remoteMessage);
        
        if (onNotificationResponse) {
          onNotificationResponse({
            notification: {
              request: {
                content: {
                  data: remoteMessage.data,
                  title: remoteMessage.notification?.title,
                  body: remoteMessage.notification?.body,
                }
              }
            }
          });
        }
        
        const notificationId = remoteMessage.data?.notification_id;
        if (notificationId) {
          this.trackNotificationOpen(notificationId);
        }
      }
    });

    // Also set up Expo notification listeners for local notifications
    this.notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Local notification received:', notification);
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    });

    this.responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification response:', response);
      
      const data = response.notification?.request?.content?.data || {};
      
      if (data.notification_id) {
        this.trackNotificationOpen(data.notification_id);
      }
      
      if (onNotificationResponse) {
        onNotificationResponse(response);
      }
    });
  }

  /**
   * Track notification open for analytics
   */
  async trackNotificationOpen(notificationId, userId = null) {
    const trackUserId = userId || this.userId;
    if (!notificationId || !trackUserId) {
      console.log('Cannot track open: missing notification_id or user_id');
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
    if (this.fcmForegroundListener) {
      this.fcmForegroundListener();
    }
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }

  /**
   * Get stored FCM token
   */
  async getStoredFcmToken() {
    try {
      return await AsyncStorage.getItem('fcm_token');
    } catch (error) {
      console.error('Error getting stored FCM token:', error);
      return null;
    }
  }

  /**
   * Subscribe to a topic for group notifications
   */
  async subscribeToTopic(topic) {
    try {
      await messaging().subscribeToTopic(topic);
      console.log(`Subscribed to topic: ${topic}`);
      return true;
    } catch (error) {
      console.error(`Error subscribing to topic ${topic}:`, error);
      return false;
    }
  }

  /**
   * Unsubscribe from a topic
   */
  async unsubscribeFromTopic(topic) {
    try {
      await messaging().unsubscribeFromTopic(topic);
      console.log(`Unsubscribed from topic: ${topic}`);
      return true;
    } catch (error) {
      console.error(`Error unsubscribing from topic ${topic}:`, error);
      return false;
    }
  }

  /**
   * Schedule a local notification
   */
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

export default new FCMPushNotificationService();

import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { trackingAPI } from '../services/api';

// Global error reporter for automatic error capture
class ErrorReporter {
  static userId = null;
  static userEmail = null;

  static setUser(userId, email) {
    this.userId = userId;
    this.userEmail = email;
  }

  static clearUser() {
    this.userId = null;
    this.userEmail = null;
  }

  static async reportError(error, context = {}) {
    try {
      const errorData = {
        error_type: error.name || 'Error',
        message: error.message || String(error),
        stack_trace: error.stack || '',
        component: context.component || '',
        screen: context.screen || '',
        action: context.action || '',
        
        // User info
        user_id: this.userId,
        user_email: this.userEmail,
        
        // Device info
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        device_type: Platform.OS,
        device_manufacturer: Device.manufacturer || 'Unknown',
        device_model: Device.modelName || 'Unknown',
        os_version: `${Platform.OS} ${Device.osVersion || Platform.Version}`,
        app_version: Application.nativeApplicationVersion || '1.0.0',
        device_info: {
          brand: Device.brand,
          modelName: Device.modelName,
          osVersion: Device.osVersion,
          isDevice: Device.isDevice,
        },
        
        // Context
        extra_context: context.extra || {},
        severity: context.severity || 'error',
        is_fatal: context.isFatal || false,
      };

      await trackingAPI.reportError(errorData);
      console.log('Error reported:', errorData.error_type);
    } catch (reportError) {
      console.log('Failed to report error (silent fail):', reportError.message);
    }
  }

  static captureException(error, context = {}) {
    this.reportError(error, context);
  }

  static captureMessage(message, severity = 'info', context = {}) {
    const error = new Error(message);
    this.reportError(error, { ...context, severity });
  }
}

// Setup global error handler
export const setupGlobalErrorHandler = () => {
  // Handle unhandled promise rejections
  const promiseHandler = (reason, promise) => {
    console.log('Unhandled Promise Rejection:', reason);
    ErrorReporter.reportError(
      reason instanceof Error ? reason : new Error(String(reason)),
      { action: 'unhandled_promise', severity: 'error' }
    );
  };

  // For React Native, we can't easily add window event listeners
  // Instead, this should be called in error boundaries
  if (global.ErrorUtils) {
    const originalHandler = global.ErrorUtils.getGlobalHandler();
    global.ErrorUtils.setGlobalHandler((error, isFatal) => {
      ErrorReporter.reportError(error, { 
        action: 'global_error_handler', 
        severity: isFatal ? 'critical' : 'error',
        isFatal 
      });
      originalHandler?.(error, isFatal);
    });
  }
};

export default ErrorReporter;

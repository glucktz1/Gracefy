import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';

const { width } = Dimensions.get('window');

// Toast types
const TOAST_TYPES = {
  success: { icon: 'checkmark-circle', color: '#4CAF50' },
  error: { icon: 'alert-circle', color: '#F44336' },
  warning: { icon: 'warning', color: '#FF9800' },
  info: { icon: 'information-circle', color: '#2196F3' },
};

// Global toast state
let toastCallback = null;

export const showToast = (message, type = 'success', duration = 2500) => {
  if (toastCallback) {
    toastCallback(message, type, duration);
  }
};

export const ToastProvider = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState('success');
  const [opacity] = useState(new Animated.Value(0));
  const [translateY] = useState(new Animated.Value(-100));

  const show = useCallback((msg, toastType = 'success', duration = 2500) => {
    setMessage(msg);
    setType(toastType);
    setVisible(true);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto hide after duration
    setTimeout(() => {
      hide();
    }, duration);
  }, [opacity, translateY]);

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
    });
  }, [opacity, translateY]);

  useEffect(() => {
    toastCallback = show;
    return () => {
      toastCallback = null;
    };
  }, [show]);

  const toastConfig = TOAST_TYPES[type] || TOAST_TYPES.info;

  return (
    <>
      {children}
      {visible && (
        <Animated.View
          style={[
            styles.container,
            {
              opacity,
              transform: [{ translateY }],
              borderLeftColor: toastConfig.color,
            },
          ]}
        >
          <Ionicons name={toastConfig.icon} size={22} color={toastConfig.color} />
          <Text style={styles.message} numberOfLines={2}>{message}</Text>
        </Animated.View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: SPACING.md,
    right: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderLeftWidth: 4,
    zIndex: 9999,
  },
  message: {
    flex: 1,
    marginLeft: SPACING.sm,
    color: COLORS.text,
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
  },
});

export default ToastProvider;

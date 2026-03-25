import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Bell, BellRing, Check, CheckCheck, X, CreditCard, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

// Notification sound (simple beep)
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 880; // A5 note
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (e) {
    console.log('Audio not supported');
  }
};

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState({
    payment_notifications: true,
    sound_enabled: true,
    browser_notifications: true
  });
  const [showSettings, setShowSettings] = useState(false);
  const lastNotificationRef = useRef(null);
  const dropdownRef = useRef(null);

  // Request browser notification permission
  useEffect(() => {
    if (settings.browser_notifications && 'Notification' in window) {
      Notification.requestPermission();
    }
  }, [settings.browser_notifications]);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/notifications?limit=20`);
      const newNotifications = res.data.notifications || [];
      const newUnread = res.data.unread_count || 0;
      
      // Check for new notifications
      if (newNotifications.length > 0 && lastNotificationRef.current) {
        const latestNotifId = newNotifications[0]?.notification_id;
        if (latestNotifId !== lastNotificationRef.current) {
          // New notification arrived!
          const newNotif = newNotifications[0];
          
          if (settings.sound_enabled) {
            playNotificationSound();
          }
          
          if (settings.browser_notifications && Notification.permission === 'granted') {
            new Notification(newNotif.title, {
              body: newNotif.message,
              icon: '/gracefy-icon.png',
              tag: newNotif.notification_id
            });
          }
          
          // Show toast
          toast.success(newNotif.title, {
            description: newNotif.message,
            duration: 5000
          });
        }
      }
      
      if (newNotifications.length > 0) {
        lastNotificationRef.current = newNotifications[0]?.notification_id;
      }
      
      setNotifications(newNotifications);
      setUnreadCount(newUnread);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, [settings.sound_enabled, settings.browser_notifications]);

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/notifications/settings`);
      setSettings(res.data);
    } catch (error) {
      console.error('Failed to fetch notification settings:', error);
    }
  }, []);

  // Poll for notifications every 10 seconds
  useEffect(() => {
    fetchNotifications();
    fetchSettings();
    
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [fetchNotifications, fetchSettings]);

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      await axios.post(`${API}/admin/notifications/${notificationId}/read`);
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await axios.post(`${API}/admin/notifications/mark-all-read`);
      fetchNotifications();
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // Update settings
  const updateSettings = async (newSettings) => {
    try {
      await axios.put(`${API}/admin/notifications/settings`, newSettings);
      setSettings(newSettings);
      toast.success('Notification settings updated');
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setShowSettings(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'payment_success':
        return <DollarSign className="w-4 h-4 text-emerald-400" />;
      default:
        return <Bell className="w-4 h-4 text-violet-400" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-zinc-800 transition-colors"
      >
        {unreadCount > 0 ? (
          <BellRing className="w-5 h-5 text-violet-400 animate-pulse" />
        ) : (
          <Bell className="w-5 h-5 text-zinc-400" />
        )}
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <h3 className="font-semibold text-white">Notifications</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                title="Settings"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="p-4 border-b border-zinc-800 bg-zinc-800/50">
              <h4 className="text-sm font-medium text-white mb-3">Notification Settings</h4>
              
              <label className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-400">Payment Notifications</span>
                <input
                  type="checkbox"
                  checked={settings.payment_notifications}
                  onChange={(e) => updateSettings({ ...settings, payment_notifications: e.target.checked })}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-violet-500 focus:ring-violet-500"
                />
              </label>
              
              <label className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-400">Sound Alerts</span>
                <input
                  type="checkbox"
                  checked={settings.sound_enabled}
                  onChange={(e) => updateSettings({ ...settings, sound_enabled: e.target.checked })}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-violet-500 focus:ring-violet-500"
                />
              </label>
              
              <label className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Browser Notifications</span>
                <input
                  type="checkbox"
                  checked={settings.browser_notifications}
                  onChange={(e) => updateSettings({ ...settings, browser_notifications: e.target.checked })}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-violet-500 focus:ring-violet-500"
                />
              </label>
            </div>
          )}

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.notification_id}
                  className={`p-4 border-b border-zinc-800/50 hover:bg-zinc-800/50 transition-colors ${
                    !notif.is_read ? 'bg-violet-900/10' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-zinc-800">
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium ${!notif.is_read ? 'text-white' : 'text-zinc-300'}`}>
                          {notif.title}
                        </p>
                        {!notif.is_read && (
                          <button
                            onClick={() => markAsRead(notif.notification_id)}
                            className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-white flex-shrink-0"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">{notif.message}</p>
                      <p className="text-xs text-zinc-600 mt-1">
                        {new Date(notif.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

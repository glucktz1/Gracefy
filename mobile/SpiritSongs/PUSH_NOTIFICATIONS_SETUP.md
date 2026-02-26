# 🔔 Push Notifications Setup Guide for Gracefy

This guide explains how to set up Firebase Cloud Messaging (FCM) for push notifications in the Gracefy mobile app.

---

## Prerequisites

1. **Firebase Account** - Create one at https://console.firebase.google.com
2. **Expo Push Notifications** - Already configured in the app

---

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **"Add Project"**
3. Name it **"Gracefy"** or **"Gracefy-App"**
4. Enable/disable Google Analytics (optional)
5. Click **"Create Project"**

---

## Step 2: Add Android App to Firebase

1. In Firebase Console, click **"Add app"** → Select **Android**
2. Enter package name: `com.spiritsongs.app`
3. Enter app nickname: **Gracefy**
4. Download `google-services.json`
5. Place the file in `/app/mobile/SpiritSongs/` directory

---

## Step 3: Get FCM Server Key

1. In Firebase Console → Project Settings → **Cloud Messaging** tab
2. Find **"Server key"** under "Cloud Messaging API (Legacy)"
3. Copy the server key - you'll need it for the backend

> ⚠️ If you see "Cloud Messaging API (Legacy) disabled", click "Enable" or use the newer FCM v1 API.

---

## Step 4: Configure Expo for FCM

### 4.1 Update `app.json`:

```json
{
  "expo": {
    "android": {
      "package": "com.spiritsongs.app",
      "googleServicesFile": "./google-services.json"
    },
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#8b5cf6",
          "sounds": ["./assets/notification-sound.wav"]
        }
      ]
    ]
  }
}
```

### 4.2 Install required packages (if not already):

```bash
cd /app/mobile/SpiritSongs
npx expo install expo-notifications expo-device expo-constants
```

---

## Step 5: Backend Configuration

Add these environment variables to `/app/backend/.env`:

```bash
# Firebase FCM Configuration
FCM_SERVER_KEY=your_fcm_server_key_here
FCM_SENDER_ID=your_sender_id_here
```

---

## Step 6: Register Push Token in App

The app already has push notification setup in `AuthContext.js`. When a user logs in, their push token is registered with the backend.

**Key files:**
- `/app/mobile/SpiritSongs/src/context/AuthContext.js` - Token registration
- `/app/backend/routes/auth.py` - Token storage endpoint

---

## Step 7: Sending Push Notifications

### Types of notifications you can send:

1. **New Content Alerts** - When new albums/songs are added
2. **Payment Confirmations** - Subscription success
3. **Promotional** - New features, special offers
4. **Reminders** - Subscription expiry

### Backend API to send notifications:

```python
# In your backend route
from services.push_notifications import send_push_notification

# Send to single user
await send_push_notification(
    user_id="user_123",
    title="New Album Available!",
    body="Check out the latest worship songs",
    data={"screen": "album", "album_id": "alb_xyz"}
)

# Send to all subscribers
await send_push_to_subscribers(
    title="🎵 New Release!",
    body="Fresh worship music just dropped"
)
```

---

## Step 8: Test Push Notifications

### Using Expo's push notification tool:

1. Get your device's push token from the app logs
2. Go to https://expo.dev/notifications
3. Enter the push token and test message
4. Send test notification

### Using Firebase Console:

1. Go to Firebase Console → Cloud Messaging
2. Click **"New Campaign"** → **"Notifications"**
3. Enter title and body
4. Select target: Your app
5. Send test message

---

## Admin Panel Features (Already Implemented)

✅ **Payment Notifications** - Admin gets notified on successful payments
✅ **Sound Alerts** - Toggleable beep sound
✅ **Browser Notifications** - Desktop push when on dashboard
✅ **Settings** - Admin can enable/disable each notification type

---

## Common Issues

### Push token not registering?
- Ensure device has Google Play Services (for Android)
- Check that notification permissions are granted
- Verify `google-services.json` is in the correct location

### Notifications not appearing?
- Check device notification settings
- Ensure app is not in "Do Not Disturb" mode
- Verify FCM server key is correct

---

## Next Steps

1. **Create Firebase Project** and get credentials
2. **Download `google-services.json`** and place in app folder
3. **Add FCM_SERVER_KEY** to backend `.env`
4. **Trigger new build** with: `npx eas build --platform android --profile preview`
5. **Test** using Expo's notification tool

---

## Need Help?

- Firebase FCM Docs: https://firebase.google.com/docs/cloud-messaging
- Expo Notifications: https://docs.expo.dev/push-notifications/overview/

/**
 * Firebase Configuration for Gracefy Mobile App
 * Provides Firebase Auth and FCM Push Notifications
 */

// Firebase configuration - same project as web
export const firebaseConfig = {
  apiKey: "AIzaSyD_5EWohUb1rTuONZvyJIwGZQ3ettf29DE",
  authDomain: "gracefyapp-824ff.firebaseapp.com",
  projectId: "gracefyapp-824ff",
  storageBucket: "gracefyapp-824ff.firebasestorage.app",
  messagingSenderId: "478977168051",
  appId: "1:478977168051:android:bcb5f39e488a23d6ca96c6", // Android app ID
  measurementId: "G-0TP6YQZPZW"
};

// iOS specific config (bundle ID: gracefy.IosApp)
export const iosFirebaseConfig = {
  ...firebaseConfig,
  appId: "1:478977168051:ios:4c9d452c88ecb1adca96c6"
};

// Web client ID for Google Sign-In
export const GOOGLE_WEB_CLIENT_ID = "478977168051-YOUR_WEB_CLIENT_ID.apps.googleusercontent.com";

// Android client ID for Google Sign-In (from google-services.json)
export const GOOGLE_ANDROID_CLIENT_ID = "478977168051-android-client-id.apps.googleusercontent.com";

// iOS client ID for Google Sign-In
export const GOOGLE_IOS_CLIENT_ID = "478977168051-ios-client-id.apps.googleusercontent.com";

export default firebaseConfig;

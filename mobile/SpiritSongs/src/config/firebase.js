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
  appId: "1:478977168051:android:bcb5f39e488a23d6ca96c6",
  measurementId: "G-0TP6YQZPZW"
};

// iOS specific config (bundle ID: gracefy.IosApp)
export const iosFirebaseConfig = {
  ...firebaseConfig,
  appId: "1:478977168051:ios:4c9d452c88ecb1adca96c6",
  apiKey: "AIzaSyDnrCh4dLbpayHKREt-aeLAHIILv_zymvY"
};

// OAuth Client IDs for Google Sign-In
export const GOOGLE_WEB_CLIENT_ID = "478977168051-701oerhk4inc4fk1tgf7iu67qkbq1mso.apps.googleusercontent.com";
export const GOOGLE_IOS_CLIENT_ID = "478977168051-8iat7t5rgqkqmr8ra1ufqlbd6pcqsl8p.apps.googleusercontent.com";

// VAPID key for web push notifications
export const VAPID_KEY = "BERvTaRmgaDvWYitKhhtTqsuZoW7QDPA3q2c2WTl7B30_k0oCl7isZuIH3tVksGDE2ODw9D-OfUs64PzG3EqVP8";

export default firebaseConfig;

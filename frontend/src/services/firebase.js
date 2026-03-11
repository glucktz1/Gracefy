/**
 * Firebase Configuration for Gracefy Web App
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD_5EWohUb1rTuONZvyJIwGZQ3ettf29DE",
  authDomain: "gracefyapp-824ff.firebaseapp.com",
  projectId: "gracefyapp-824ff",
  storageBucket: "gracefyapp-824ff.firebasestorage.app",
  messagingSenderId: "478977168051",
  appId: "1:478977168051:web:4a6f2e39ca9a29cbca96c6",
  measurementId: "G-0TP6YQZPZW"
};

// Initialize Firebase
let app;
try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
} catch (error) {
  console.error('Firebase init error:', error);
  app = initializeApp(firebaseConfig);
}

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Auth functions
export const firebaseSignInWithEmail = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    let message = 'Login failed';
    if (error.code === 'auth/user-not-found') message = 'Account not found';
    else if (error.code === 'auth/wrong-password') message = 'Invalid password';
    else if (error.code === 'auth/invalid-email') message = 'Invalid email';
    else if (error.code === 'auth/invalid-credential') message = 'Invalid email or password';
    else if (error.code === 'auth/too-many-requests') message = 'Too many attempts. Try later.';
    return { success: false, error: message };
  }
};

export const firebaseSignUpWithEmail = async (email, password, name) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (name) {
      await updateProfile(userCredential.user, { displayName: name });
    }
    return { success: true, user: userCredential.user };
  } catch (error) {
    let message = 'Registration failed';
    if (error.code === 'auth/email-already-in-use') message = 'Email already registered';
    else if (error.code === 'auth/weak-password') message = 'Password too weak';
    else if (error.code === 'auth/invalid-email') message = 'Invalid email';
    return { success: false, error: message };
  }
};

export const firebaseSignInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { success: true, user: result.user };
  } catch (error) {
    console.error('Google sign-in error:', error);
    let message = 'Google sign-in failed';
    if (error.code === 'auth/popup-closed-by-user') {
      message = 'Sign-in cancelled';
    } else if (error.code === 'auth/popup-blocked') {
      message = 'Popup blocked. Please allow popups for this site.';
    } else if (error.code === 'auth/unauthorized-domain') {
      message = 'This domain is not authorized. Contact support.';
    } else if (error.code === 'auth/operation-not-allowed') {
      message = 'Google sign-in is not enabled. Contact support.';
    }
    return { success: false, error: message };
  }
};

export const firebaseSignOut = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const firebaseResetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to send reset email' };
  }
};

export const getFirebaseIdToken = async () => {
  const user = auth.currentUser;
  if (user) {
    return await user.getIdToken();
  }
  return null;
};

export const onFirebaseAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

export { auth, googleProvider };
export default app;

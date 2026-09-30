// Firebase Auth (Google sign-in) for Clip Forge Pro accounts. This config is
// the public web app config from the Firebase console — safe to commit, not
// a secret (unlike the Admin SDK service account key used server-side).
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDw-8NHnoVtACBfALB6ebRqTU_LESWKYq4',
  authDomain: 'clipforge-9453d.firebaseapp.com',
  projectId: 'clipforge-9453d',
  storageBucket: 'clipforge-9453d.firebasestorage.app',
  messagingSenderId: '694357381453',
  appId: '1:694357381453:web:06a877f0a8f048cc52a704',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function signOutUser() {
  return signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// Backend calls attach this so the server can verify who's actually asking,
// instead of trusting a client-supplied email string.
export async function getIdToken() {
  const user = auth.currentUser;
  return user ? user.getIdToken() : null;
}

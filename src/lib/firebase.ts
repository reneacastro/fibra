import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  type Auth
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore
} from 'firebase/firestore';
import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';

let app: FirebaseApp | undefined;
let _auth: Auth | undefined;
let _db: Firestore | undefined;

function getConfig() {
  return {
    apiKey: env.PUBLIC_FIREBASE_API_KEY,
    authDomain: env.PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.PUBLIC_FIREBASE_APP_ID
  };
}

export function getFirebase() {
  if (!browser) throw new Error('Firebase só no client');
  if (!app) {
    app = getApps()[0] ?? initializeApp(getConfig());
  }
  return app;
}

export function auth(): Auth {
  if (!_auth) _auth = getAuth(getFirebase());
  return _auth;
}

export function db(): Firestore {
  if (!_db) {
    _db = initializeFirestore(getFirebase(), {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  }
  return _db;
}

export const googleProvider = new GoogleAuthProvider();

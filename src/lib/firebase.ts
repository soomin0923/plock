import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import config from '../../firebase-applet-config.json';

// The Firebase web config is public by design (it identifies the project, it does not grant access).
// Access control lives in firestore.rules: each signed-in user can only touch accounts/{their uid}.

const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
const servedByFirebaseHosting = hostname.endsWith('.web.app') || hostname.endsWith('.firebaseapp.com');

const options: FirebaseOptions = {
  apiKey: config.apiKey,
  appId: config.appId,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  // When the app is served from Firebase Hosting, use the same domain for the auth handler.
  // Otherwise Google sign-in via redirect breaks in browsers that partition third-party storage
  // (Safari, Chrome on iOS, Firefox) because *.web.app and *.firebaseapp.com are different sites.
  authDomain: servedByFirebaseHosting ? hostname : config.authDomain,
};

export const firebaseApp = initializeApp(options);
export const auth = getAuth(firebaseApp);
auth.languageCode = 'ko';

export const firestoreDatabaseId: string | undefined = (config as { firestoreDatabaseId?: string }).firestoreDatabaseId;

export const useEmulator = import.meta.env.VITE_FIREBASE_EMULATOR === '1';
if (useEmulator) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}

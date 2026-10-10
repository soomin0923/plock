import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import config from '../../firebase-applet-config.json';

// The Firebase web config is public by design (it identifies the project, it does not grant access).
// Access control lives in firestore.rules: each signed-in user can only touch accounts/{their uid}.

const options: FirebaseOptions = {
  apiKey: config.apiKey,
  appId: config.appId,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  // Keep the default <project>.firebaseapp.com handler: it is the only redirect URI registered on the
  // project's auto-created Google OAuth client. Using *.web.app here fails with redirect_uri_mismatch.
  // Google sign-in uses a popup (see lib/auth.ts), which works across the two domains in all browsers.
  authDomain: config.authDomain,
};

export const firebaseApp = initializeApp(options);
export const auth = getAuth(firebaseApp);
auth.languageCode = 'ko';

export const firestoreDatabaseId: string | undefined = (config as { firestoreDatabaseId?: string }).firestoreDatabaseId;

export const useEmulator = import.meta.env.VITE_FIREBASE_EMULATOR === '1';
if (useEmulator) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}

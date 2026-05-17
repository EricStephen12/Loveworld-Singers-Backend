import admin from 'firebase-admin'

// Support both naming conventions for env vars
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.NEXT_PUBLIC_FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.NEXT_PUBLIC_FIREBASE_ADMIN_PRIVATE_KEY;
const databaseURL = process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'https://loveworld-singers-app-default-rtdb.firebaseio.com';

if (!admin.apps.length) {
    try {
        if (projectId && clientEmail && privateKey) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey: privateKey.replace(/\\n/g, '\n'),
                }),
                databaseURL
            });

        } else {
 console.warn('️ Firebase Admin credentials missing');
        }
    } catch (error) {
 console.error(' Firebase Admin init error:', error);
    }
} else {
    // If already initialized, use the existing app
    // This prevents "Firebase App named '[DEFAULT]' already exists" error
    // and helps avoid memory leaks from re-initialization
}

const db = admin.firestore();
const rtdb = admin.database();
const auth = admin.auth();
const messaging = admin.messaging();
const FieldValue = admin.firestore.FieldValue;

export { admin, db, rtdb, auth, messaging, FieldValue };

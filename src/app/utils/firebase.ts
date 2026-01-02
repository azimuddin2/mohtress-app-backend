import admin from 'firebase-admin';
import path from 'path';

// Absolute path to firebase.json
const serviceAccountPath = path.join(process.cwd(), 'firebase.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
  });
  console.log('Firebase admin initialized ✅');
}

export default admin;

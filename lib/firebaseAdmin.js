// lib/firebaseAdmin.js
//
// This uses the Firebase ADMIN SDK, which is different from the
// regular Firebase SDK used in the browser. The Admin SDK runs only
// on the server and has full read/write access to Firestore,
// bypassing the security rules we wrote earlier (rules only apply
// to browser/client requests, not trusted server code).
//
// It needs a "service account" key from Firebase — a separate
// credential from the web app config you already have. We'll get
// this from you in the next step.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT environment variable.');
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch (e) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON.');
  }

  return initializeApp({
    credential: cert(serviceAccount)
  });
}

export async function saveDriveTokensForStudio(studioId, tokens) {
  const app = getAdminApp();
  const db = getFirestore(app);

  await db.collection('studios').doc(studioId).set(
    {
      drive: {
        connected: true,
        connectedEmail: tokens.connectedEmail,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        connectedAt: Date.now()
      }
    },
    { merge: true }
  );
}

export async function getDriveTokensForStudio(studioId) {
  const app = getAdminApp();
  const db = getFirestore(app);

  const doc = await db.collection('studios').doc(studioId).get();
  if (!doc.exists) return null;

  const data = doc.data();
  return data.drive || null;
}

export async function refreshAccessTokenIfNeeded(studioId) {
  const tokens = await getDriveTokensForStudio(studioId);
  if (!tokens) throw new Error('No Drive connection found for this studio.');

  const isExpired = Date.now() > tokens.expiresAt - 60000; // refresh 1 min early
  if (!isExpired) return tokens.accessToken;

  if (!tokens.refreshToken) {
    throw new Error('No refresh token available. User needs to reconnect Drive.');
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refreshToken,
      grant_type: 'refresh_token'
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error('Failed to refresh access token: ' + JSON.stringify(data));
  }

  const app = getAdminApp();
  const db = getFirestore(app);
  const newExpiresAt = Date.now() + (data.expires_in * 1000);

  await db.collection('studios').doc(studioId).set(
    {
      drive: {
        accessToken: data.access_token,
        expiresAt: newExpiresAt
      }
    },
    { merge: true }
  );

  return data.access_token;
}

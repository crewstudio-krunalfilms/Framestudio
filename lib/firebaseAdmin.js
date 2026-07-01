import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function adminApp() {
  if (getApps().length) return getApps()[0];
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!sa) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT env var');
  return initializeApp({ credential: cert(JSON.parse(sa)) });
}

function db() { return getFirestore(adminApp()); }

export async function saveDriveTokens(studioId, tokens) {
  await db().collection('studios').doc(studioId).set(
    { drive: { connected:true, ...tokens, connectedAt:Date.now() } },
    { merge:true }
  );
}

export async function getDriveTokens(studioId) {
  const d = await db().collection('studios').doc(studioId).get();
  return d.exists ? (d.data().drive || null) : null;
}

export async function getFreshAccessToken(studioId) {
  const tokens = await getDriveTokens(studioId);
  if (!tokens) throw new Error('Drive not connected for this studio');
  if (!tokens.connected) throw new Error('Drive was disconnected');

  if (Date.now() < tokens.expiresAt - 60000) return tokens.accessToken;

  if (!tokens.refreshToken) throw new Error('No refresh token — user must reconnect Drive');

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: '644674946255-ceq37p181dvmk17bc2j9pvpmmblrtgbr.apps.googleusercontent.com',
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: tokens.refreshToken,
      grant_type: 'refresh_token'
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error('Token refresh failed: ' + JSON.stringify(data));

  const newExpiry = Date.now() + data.expires_in * 1000;
  await db().collection('studios').doc(studioId).set(
    { drive: { accessToken: data.access_token, expiresAt: newExpiry } },
    { merge:true }
  );
  return data.access_token;
}

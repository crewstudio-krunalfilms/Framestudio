// api/auth/google/callback.js
// Google redirects here after the user approves Drive access.
// Exchanges the code for real tokens and saves them to Firestore.

import { saveDriveTokensForStudio } from '../../../lib/firebaseAdmin.js';

const CLIENT_ID = '644674946255-ceq37p181dvmk17bc2j9pvpmmblrtgbr.apps.googleusercontent.com';
const SITE_URL = 'https://framestudio-three.vercel.app';
const REDIRECT_URI = `${SITE_URL}/api/auth/google/callback`;

export default async function handler(req, res) {
  const { code, state, error } = req.query;

  if (error) {
    res.redirect(302, `${SITE_URL}/index.html?drive_error=${encodeURIComponent(error)}`);
    return;
  }

  if (!code || !state) {
    res.status(400).send('Missing code or state from Google.');
    return;
  }

  let studioId;
  try {
    const parsedState = JSON.parse(decodeURIComponent(state));
    studioId = parsedState.studioId;
  } catch (e) {
    res.status(400).send('Invalid state parameter.');
    return;
  }

  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientSecret) {
    res.status(500).send('Server is missing GOOGLE_CLIENT_SECRET.');
    return;
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenData);
      res.redirect(302, `${SITE_URL}/index.html?drive_error=token_exchange_failed`);
      return;
    }

    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile = await profileResponse.json();

    await saveDriveTokensForStudio(studioId, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || null,
      expiresAt: Date.now() + (tokenData.expires_in * 1000),
      connectedEmail: profile.email || null
    });

    res.redirect(302, `${SITE_URL}/index.html?drive_connected=true`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect(302, `${SITE_URL}/index.html?drive_error=server_error`);
  }
}

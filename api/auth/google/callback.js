// api/auth/google/callback.js
//
// Google redirects the user back here after they approve access.
// This file does the one truly sensitive step: exchanging the
// temporary "code" Google gave us for a real access token + refresh
// token, using GOOGLE_CLIENT_SECRET. This exchange MUST happen on
// the server — the secret can never be sent to the browser.
//
// After exchanging, it saves the tokens to Firestore under the
// photographer's studio document, then redirects them back to the
// dashboard with a success flag.

import { saveDriveTokensForStudio } from '../../../lib/firebaseAdmin.js';

export default async function handler(req, res) {
  const { code, state, error } = req.query;
  const siteUrl = process.env.SITE_URL || 'https://framestudio-three.vercel.app';

  if (error) {
    res.redirect(302, `${siteUrl}/index.html?drive_error=${encodeURIComponent(error)}`);
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

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${siteUrl}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    res.status(500).send('Server is missing Google OAuth credentials.');
    return;
  }

  try {
    // Exchange the authorization code for real tokens.
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Google token exchange failed:', tokenData);
      res.redirect(302, `${siteUrl}/index.html?drive_error=token_exchange_failed`);
      return;
    }

    // tokenData contains: access_token, refresh_token, expires_in, scope, token_type
    // refresh_token only appears the FIRST time a user consents — store it carefully.

    // Get the connected Google account's email for display purposes.
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

    res.redirect(302, `${siteUrl}/index.html?drive_connected=true`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect(302, `${siteUrl}/index.html?drive_error=server_error`);
  }
}

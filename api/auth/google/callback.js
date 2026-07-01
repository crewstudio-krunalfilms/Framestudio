import { saveDriveTokens } from '../../../lib/firebaseAdmin.js';

const CLIENT_ID    = '644674946255-ceq37p181dvmk17bc2j9pvpmmblrtgbr.apps.googleusercontent.com';
const SITE_URL     = 'https://framestudio-three.vercel.app';
const REDIRECT_URI = SITE_URL + '/api/auth/google/callback';

export default async function handler(req, res) {
  const { code, state, error } = req.query;

  if (error) {
    res.redirect(302, SITE_URL + '/?drive_error=' + encodeURIComponent(error));
    return;
  }
  if (!code || !state) {
    res.status(400).send('Missing code or state');
    return;
  }

  let studioId;
  try { studioId = JSON.parse(decodeURIComponent(state)).studioId; }
  catch { res.status(400).send('Bad state param'); return; }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  REDIRECT_URI,
        grant_type:    'authorization_code'
      })
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(JSON.stringify(tokens));

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: 'Bearer ' + tokens.access_token }
    });
    const profile = await profileRes.json();

    await saveDriveTokens(studioId, {
      accessToken:    tokens.access_token,
      refreshToken:   tokens.refresh_token || null,
      expiresAt:      Date.now() + tokens.expires_in * 1000,
      connectedEmail: profile.email || null
    });

    res.redirect(302, SITE_URL + '/?drive_connected=1');
  } catch (err) {
    console.error('OAuth callback error:', err.message);
    res.redirect(302, SITE_URL + '/?drive_error=server_error');
  }
}

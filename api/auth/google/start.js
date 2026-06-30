// api/auth/google/start.js
//
// This file runs on Vercel's server (never in the browser).
// When a photographer clicks "Connect Google Drive" on the site,
// the browser calls this endpoint, which redirects them to Google's
// real consent screen.
//
// It reads GOOGLE_CLIENT_ID from Vercel's environment variables —
// the Client ID is safe to use here since it's not secret.

export default function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const siteUrl = process.env.SITE_URL || 'https://framestudio-three.vercel.app';

  if (!clientId) {
    res.status(500).send('Server is missing GOOGLE_CLIENT_ID. Check Vercel environment variables.');
    return;
  }

  // studioId identifies which photographer is connecting —
  // passed in from the browser as a query param, e.g. ?studioId=abc123
  const studioId = req.query.studioId;
  if (!studioId) {
    res.status(400).send('Missing studioId. This should be the signed-in user\'s Firebase UID.');
    return;
  }

  const redirectUri = `${siteUrl}/api/auth/google/callback`;

  const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email'
  ].join(' ');

  // "state" carries the studioId through the Google flow so we know
  // whose account to attach the Drive connection to when Google sends
  // the user back to us.
  const state = encodeURIComponent(JSON.stringify({ studioId }));

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent',
    state
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  res.redirect(302, googleAuthUrl);
}

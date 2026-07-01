// api/auth/google/start.js
// Redirects the photographer to Google's real OAuth consent screen.
// Client ID is hardcoded since it is not secret.

export default function handler(req, res) {
  const clientId = '644674946255-ceq37p181dvmk17bc2j9pvpmmblrtgbr.apps.googleusercontent.com';
  const siteUrl = 'https://framestudio-three.vercel.app';

  const studioId = req.query.studioId;
  if (!studioId) {
    res.status(400).send('Missing studioId.');
    return;
  }

  const redirectUri = `${siteUrl}/api/auth/google/callback`;

  const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email'
  ].join(' ');

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

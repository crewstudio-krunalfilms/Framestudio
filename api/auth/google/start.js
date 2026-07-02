const CLIENT_ID = '644674946255-ceq37p181dvmk17bc2j9pvpmmblrtgbr.apps.googleusercontent.com';
const SITE_URL  = 'https://project-bzwee.vercel.app';

export default function handler(req, res) {
  const studioId = req.query.studioId;
  if (!studioId) { res.status(400).send('Missing studioId'); return; }

  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  SITE_URL + '/api/auth/google/callback',
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
    access_type:   'offline',
    prompt:        'consent',
    state:         encodeURIComponent(JSON.stringify({ studioId }))
  });

  res.redirect(302, 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString());
}

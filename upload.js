// api/drive/upload.js
//
// Called from the dashboard when a photographer uploads a photo.
// Uses the studio's stored Drive access token to create (or reuse)
// a folder named after the gallery, then uploads the file into it.
//
// The browser sends: studioId, galleryId, galleryFolderName, fileName,
// fileType, and the raw file bytes (base64-encoded).
//
// This keeps the access token server-side at all times — the browser
// never sees it.

import { refreshAccessTokenIfNeeded } from '../../lib/firebaseAdmin.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb'
    }
  }
};

async function findOrCreateFolder(accessToken, folderName, parentId) {
  const query = encodeURIComponent(
    `name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false` +
    (parentId ? ` and '${parentId}' in parents` : '')
  );

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined
    })
  });
  const createData = await createRes.json();
  return createData.id;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { studioId, galleryFolderName, fileName, fileType, fileBase64 } = req.body;

  if (!studioId || !galleryFolderName || !fileName || !fileBase64) {
    res.status(400).json({ error: 'Missing required fields.' });
    return;
  }

  try {
    const accessToken = await refreshAccessTokenIfNeeded(studioId);

    // Root folder for all FrameStudio galleries, then a sub-folder per gallery.
    const rootFolderId = await findOrCreateFolder(accessToken, 'FrameStudio Galleries', null);
    const galleryFolderId = await findOrCreateFolder(accessToken, galleryFolderName, rootFolderId);

    const fileBuffer = Buffer.from(fileBase64, 'base64');

    const metadata = {
      name: fileName,
      parents: [galleryFolderId]
    };

    const boundary = '-------framestudio' + Date.now();
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;

    const multipartBody = Buffer.concat([
      Buffer.from(
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${fileType || 'application/octet-stream'}\r\n` +
        'Content-Transfer-Encoding: base64\r\n\r\n'
      ),
      Buffer.from(fileBase64),
      Buffer.from(closeDelim)
    ]);

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartBody
      }
    );

    const uploadData = await uploadRes.json();

    if (!uploadRes.ok) {
      console.error('Drive upload failed:', uploadData);
      res.status(502).json({ error: 'Drive upload failed', details: uploadData });
      return;
    }

    // Make the file viewable by anyone with the link, so the client
    // gallery page can display it without needing Drive permissions.
    await fetch(`https://www.googleapis.com/drive/v3/files/${uploadData.id}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' })
    });

    res.status(200).json({
      success: true,
      fileId: uploadData.id,
      viewLink: uploadData.webViewLink,
      directLink: `https://drive.google.com/uc?export=view&id=${uploadData.id}`
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
}

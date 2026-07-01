// api/drive/upload.js
// Uploads a photo/video to the photographer's Google Drive folder.

import { refreshAccessTokenIfNeeded } from '../../lib/firebaseAdmin.js';

export default async function handler(req, res) {
  // Handle CORS for browser requests
  res.setHeader('Access-Control-Allow-Origin', 'https://framestudio-three.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { studioId, galleryFolderName, fileName, fileType, fileBase64 } = req.body;

  if (!studioId || !galleryFolderName || !fileName || !fileBase64) {
    res.status(400).json({ error: 'Missing required fields: studioId, galleryFolderName, fileName, fileBase64' });
    return;
  }

  let accessToken;
  try {
    accessToken = await refreshAccessTokenIfNeeded(studioId);
  } catch (err) {
    console.error('Token error:', err.message);
    res.status(401).json({ error: 'Drive not connected or token expired: ' + err.message });
    return;
  }

  try {
    // Step 1: Find or create FrameStudio root folder
    const rootFolderId = await findOrCreateFolder(accessToken, 'FrameStudio Galleries', null);

    // Step 2: Find or create gallery-specific subfolder
    const galleryFolderId = await findOrCreateFolder(accessToken, galleryFolderName, rootFolderId);

    // Step 3: Upload the file using multipart upload
    const metadata = JSON.stringify({ name: fileName, parents: [galleryFolderId] });
    const boundary = 'framestudio_boundary_' + Date.now();

    const body = [
      '--' + boundary,
      'Content-Type: application/json; charset=UTF-8',
      '',
      metadata,
      '--' + boundary,
      'Content-Type: ' + (fileType || 'application/octet-stream'),
      'Content-Transfer-Encoding: base64',
      '',
      fileBase64,
      '--' + boundary + '--'
    ].join('\r\n');

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,name',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'multipart/related; boundary=' + boundary
        },
        body
      }
    );

    const uploadData = await uploadRes.json();

    if (!uploadRes.ok) {
      console.error('Drive upload API error:', JSON.stringify(uploadData));
      res.status(502).json({ error: 'Drive upload failed', details: uploadData });
      return;
    }

    // Step 4: Make file publicly viewable so gallery page can show it
    await fetch(`https://www.googleapis.com/drive/v3/files/${uploadData.id}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' })
    });

    res.status(200).json({
      success: true,
      fileId: uploadData.id,
      fileName: uploadData.name,
      viewLink: uploadData.webViewLink,
      directLink: 'https://drive.google.com/uc?export=view&id=' + uploadData.id
    });

  } catch (err) {
    console.error('Upload handler error:', err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
}

async function findOrCreateFolder(accessToken, folderName, parentId) {
  // Search for existing folder
  let qStr = `name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) qStr += ` and '${parentId}' in parents`;

  const searchRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(qStr) + '&fields=files(id,name)',
    { headers: { Authorization: 'Bearer ' + accessToken } }
  );
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create new folder
  const createBody = { name: folderName, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) createBody.parents = [parentId];

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(createBody)
  });
  const createData = await createRes.json();

  if (!createRes.ok) {
    throw new Error('Could not create Drive folder: ' + JSON.stringify(createData));
  }

  return createData.id;
}

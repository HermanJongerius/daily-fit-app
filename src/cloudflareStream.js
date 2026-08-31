// Koppeling met Cloudflare Stream voor het uploaden en klaarzetten van video's.
// Vereist CLOUDFLARE_ACCOUNT_ID en CLOUDFLARE_API_TOKEN als omgevingsvariabelen
// (aan te maken in het Cloudflare-dashboard, onder Stream / API tokens).

const API_BASE = 'https://api.cloudflare.com/client/v4';

function requireEnv() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error(
      'CLOUDFLARE_ACCOUNT_ID en/of CLOUDFLARE_API_TOKEN ontbreken. Zonder deze kan er geen video-upload-link worden aangevraagd.'
    );
  }
  return { accountId, apiToken };
}

// Vraagt een eenmalige, rechtstreekse upload-URL aan bij Cloudflare Stream.
// De browser van de beheerder upload het videobestand hier direct naartoe (niet via onze eigen server).
export async function createDirectUploadUrl({ maxDurationSeconds = 330 } = {}) {
  const { accountId, apiToken } = requireEnv();
  const res = await fetch(`${API_BASE}/accounts/${accountId}/stream/direct_upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      maxDurationSeconds, // iets ruimer dan de max. 5 minuten, als marge
      requireSignedURLs: true, // afspelen alleen via een kortlevende, ondertekende link
    }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error('Cloudflare Stream gaf een fout terug: ' + JSON.stringify(data.errors));
  }
  return { uploadUrl: data.result.uploadURL, uid: data.result.uid };
}

// Controleert of een geüploade video al verwerkt en afspeelbaar is.
export async function getVideoStatus(uid) {
  const { accountId, apiToken } = requireEnv();
  const res = await fetch(`${API_BASE}/accounts/${accountId}/stream/${uid}`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error('Cloudflare Stream gaf een fout terug: ' + JSON.stringify(data.errors));
  }
  const ready = !!data.result.readyToStream;
  const durationSec = data.result.duration && data.result.duration > 0 ? Math.round(data.result.duration) : null;
  return { ready, durationSec, status: data.result.status?.state || 'unknown' };
}

// Genereert een kortlevende, ondertekende afspeel-token voor een video (senior mag alleen
// met deze token de video zien — voorkomt dat een gedeelde link buiten de app blijft werken).
export async function createSignedPlaybackToken(uid, { expiresInSeconds = 3600 } = {}) {
  const { accountId, apiToken } = requireEnv();
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const res = await fetch(`${API_BASE}/accounts/${accountId}/stream/${uid}/token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ exp }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error('Cloudflare Stream gaf een fout terug bij het maken van een afspeel-token: ' + JSON.stringify(data.errors));
  }
  return data.result.token;
}

/**
 * Resolves Google OAuth callback URL for the current Render/host environment.
 * Prevents invalid_grant when GOOGLE_CALLBACK_URL still points at a retired hostname.
 */
function resolveGoogleCallbackUrl() {
  const configured = (process.env.GOOGLE_CALLBACK_URL || '').trim();
  const renderUrl = (process.env.RENDER_EXTERNAL_URL || '').trim().replace(/\/$/, '');

  if (!configured) {
    if (renderUrl) {
      return `${renderUrl}/api/auth/google/callback`;
    }
    return undefined;
  }

  if (!renderUrl) {
    return configured;
  }

  try {
    const configuredHost = new URL(configured).hostname;
    const renderHost = new URL(renderUrl).hostname;
    if (configuredHost !== renderHost) {
      const resolved = `${renderUrl}/api/auth/google/callback`;
      console.warn(
        `[Google OAuth] GOOGLE_CALLBACK_URL host (${configuredHost}) does not match ` +
        `RENDER_EXTERNAL_URL (${renderHost}); using ${resolved}`
      );
      return resolved;
    }
  } catch (err) {
    console.warn('[Google OAuth] Could not parse callback URL; using GOOGLE_CALLBACK_URL as-is:', err.message);
  }

  return configured;
}

function maskClientId(clientId) {
  if (!clientId) return '(unset)';
  if (clientId.length <= 12) return '***';
  return `${clientId.slice(0, 8)}...${clientId.slice(-6)}`;
}

function logOAuthDebug(label, fields) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  console.log(`[Google OAuth Debug] ${label}`, fields);
}

module.exports = {
  resolveGoogleCallbackUrl,
  maskClientId,
  logOAuthDebug
};

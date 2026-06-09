function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  };
}

function setAuthCookie(res, token) {
  res.cookie('auth_token', token, getAuthCookieOptions());
}

function clearAuthCookie(res) {
  res.clearCookie('auth_token', getAuthCookieOptions());
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}

module.exports = { setAuthCookie, clearAuthCookie, getClientIp, getAuthCookieOptions };

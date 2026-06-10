const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../db');
const { normalizeIndianMobileDigits } = require('../utils/phoneNormalize');
const { resolveGoogleCallbackUrl } = require('../utils/googleOAuth');
const { devLog, devWarn } = require('../utils/devLog');

function normalizeGoogleProfilePhone(profile) {
  const raw =
    profile?._json?.phone_number ||
    profile?._json?.mobile ||
    profile?.phoneNumbers?.[0]?.value;
  const d = normalizeIndianMobileDigits(raw);
  return d.length === 10 ? d : '';
}

function isPlaceholderProfilePhone(phone) {
  if (phone == null || String(phone).trim() === '') return true;
  return String(phone).startsWith('GOOGLE_');
}

/** Prefer a real 10-digit number from Google when the profile still has a synthetic OAuth phone. */
function resolvePhoneForGoogleLink(existingPhone, normFromGoogle, googleId) {
  if (normFromGoogle && normFromGoogle.length === 10 && isPlaceholderProfilePhone(existingPhone)) {
    return normFromGoogle;
  }
  if (existingPhone != null && String(existingPhone).trim() !== '') {
    return existingPhone;
  }
  if (normFromGoogle && normFromGoogle.length === 10) {
    return normFromGoogle;
  }
  return `GOOGLE_${googleId}`;
}

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (googleClientId && googleClientSecret) {
  const googleCallbackUrl = resolveGoogleCallbackUrl();
  console.log('[Google OAuth] Strategy configured with callback URL:', googleCallbackUrl);

  passport.use(new GoogleStrategy({
    clientID: googleClientId,
    clientSecret: googleClientSecret,
    callbackURL: googleCallbackUrl
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;
      const name = profile.displayName;
      const googleId = profile.id;
      const avatarUrl = profile.photos[0]?.value;
      const normPhone = normalizeGoogleProfilePhone(profile);

      let result = await db.query(
        'SELECT * FROM profiles WHERE provider_id = $1 OR google_id = $1',
        [googleId]
      );

      if (result.rows.length > 0) {
        const existingUser = result.rows[0];
        if (normPhone && isPlaceholderProfilePhone(existingUser.phone)) {
          try {
            result = await db.query(
              `UPDATE profiles
               SET phone = $1, updated_at = NOW()
               WHERE id = $2
               RETURNING *`,
              [normPhone, existingUser.id]
            );
          } catch (e) {
            if (e.code === '23505') {
              devWarn('[Google Auth] Could not set phone from Google (already in use):', existingUser.id);
            } else {
              throw e;
            }
          }
        } else if (!existingUser.phone) {
          const phoneNumber = normPhone || `GOOGLE_${googleId}`;
          result = await db.query(
            `UPDATE profiles
             SET phone = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [phoneNumber, existingUser.id]
          );
        } else if (!existingUser.provider_id) {
          result = await db.query(
            `UPDATE profiles
             SET provider_id = $1, auth_provider = 'google', avatar_url = COALESCE(avatar_url, $2)
             WHERE id = $3
             RETURNING *`,
            [googleId, avatarUrl, existingUser.id]
          );
        } else if (avatarUrl && existingUser.avatar_url !== avatarUrl) {
          result = await db.query(
            'UPDATE profiles SET avatar_url = $1 WHERE id = $2 RETURNING *',
            [avatarUrl, existingUser.id]
          );
        }
        const user = result.rows[0];
        devLog(`[Google Auth] Authentication successful for user: ${user.email}, ID: ${user.id}`);
        return done(null, user);
      }

      result = await db.query(
        'SELECT * FROM profiles WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))',
        [email]
      );

      if (result.rows.length > 0) {
        devLog(`[Google Auth] Updating existing user by email: ${email}`);
        const existingUser = result.rows[0];
        const nextPhone = resolvePhoneForGoogleLink(existingUser.phone, normPhone, googleId);
        try {
          result = await db.query(
            `UPDATE profiles
             SET google_id = $1, provider_id = $1, auth_provider = 'google',
                 avatar_url = COALESCE($2, avatar_url),
                 full_name = COALESCE(NULLIF(TRIM($3), ''), full_name),
                 phone = $4,
                 updated_at = NOW()
             WHERE id = $5
             RETURNING *`,
            [googleId, avatarUrl, name, nextPhone, existingUser.id]
          );
        } catch (e) {
          if (e.code === '23505' && normPhone) {
            result = await db.query(
              `UPDATE profiles
               SET google_id = $1, provider_id = $1, auth_provider = 'google',
                   avatar_url = COALESCE($2, avatar_url),
                   full_name = COALESCE(NULLIF(TRIM($3), ''), full_name),
                   updated_at = NOW()
               WHERE id = $4
               RETURNING *`,
              [googleId, avatarUrl, name, existingUser.id]
            );
          } else {
            throw e;
          }
        }
        devLog(`[Google Auth] User updated with ID: ${result.rows[0].id}`);
        return done(null, result.rows[0]);
      }

      if (normPhone.length === 10) {
        const byPhone = await db.query(
          `SELECT * FROM profiles
           WHERE role = 'customer'
             AND right(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), 10) = $1
             AND (google_id IS NULL OR google_id = $2)
             AND (provider_id IS NULL OR provider_id = $2)`,
          [normPhone, googleId]
        );
        if (byPhone.rows.length === 1) {
          const row = byPhone.rows[0];
          const emailMatches =
            row.email && email && row.email.toLowerCase() === email.toLowerCase();
          const allowPhoneMerge = emailMatches || isPlaceholderProfilePhone(row.phone);
          if (allowPhoneMerge) {
            devLog(`[Google Auth] Linking Google account to existing profile by phone (merge): ${row.id}`);
            try {
              result = await db.query(
                `UPDATE profiles
                 SET email = $1,
                     full_name = COALESCE(NULLIF(TRIM($2), ''), full_name),
                     google_id = $3, provider_id = $3, auth_provider = 'google',
                     avatar_url = COALESCE($4, avatar_url),
                     phone = $5,
                     updated_at = NOW()
                 WHERE id = $6
                 RETURNING *`,
                [email, name, googleId, avatarUrl, normPhone, row.id]
              );
              return done(null, result.rows[0]);
            } catch (e) {
              if (e.code === '23505') {
                devWarn('[Google Auth] Phone merge: email conflict; linking Google without changing email');
                result = await db.query(
                  `UPDATE profiles
                   SET full_name = COALESCE(NULLIF(TRIM($1), ''), full_name),
                       google_id = $2, provider_id = $2, auth_provider = 'google',
                       avatar_url = COALESCE($3, avatar_url),
                       phone = $4,
                       updated_at = NOW()
                   WHERE id = $5
                   RETURNING *`,
                  [name, googleId, avatarUrl, normPhone, row.id]
                );
                return done(null, result.rows[0]);
              }
              throw e;
            }
          }
        }
      }

      devLog(`[Google Auth] Creating new user: ${email}`);
      const phoneNumber = normPhone || `GOOGLE_${googleId}`;
      result = await db.query(
        `INSERT INTO profiles (email, full_name, google_id, provider_id, auth_provider, avatar_url, role, phone)
         VALUES ($1, $2, $3, $4, 'google', $5, 'customer', $6)
         RETURNING *`,
        [email, name, googleId, googleId, avatarUrl, phoneNumber]
      );
      devLog(`[Google Auth] New user created with ID: ${result.rows[0].id}`);
      try {
        const notificationService = require('../services/notification.service');
        notificationService.createNotification({
          type: 'new_customer',
          title: 'New customer registered',
          body: `${name || email} signed up via Google.`,
          entity_type: 'user',
          entity_id: result.rows[0].id,
          dedupeHours: 0
        }).catch(() => {});
      } catch {
        /* notifications optional */
      }
      return done(null, result.rows[0]);
    } catch (error) {
      console.error('[Google Auth] Error during authentication:', error);
      return done(error, null);
    }
  }
  ));
} else {
  console.warn('Google OAuth disabled: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable customer Google sign-in.');
}

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query('SELECT * FROM profiles WHERE id = $1', [id]);
    done(null, result.rows[0]);
  } catch (error) {
    done(error, null);
  }
});

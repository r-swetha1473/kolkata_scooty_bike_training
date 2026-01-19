const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('../db');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;
      const name = profile.displayName;
      const googleId = profile.id;
      const avatarUrl = profile.photos[0]?.value;

      // Check by provider_id first (new field)
      let result = await db.query(
        'SELECT * FROM profiles WHERE provider_id = $1 OR google_id = $1',
        [googleId]
      );

      if (result.rows.length === 0) {
        // Check by email
        result = await db.query(
          'SELECT * FROM profiles WHERE email = $1',
          [email]
        );

        if (result.rows.length === 0) {
          // Create new user
          console.log(`[Google Auth] Creating new user: ${email}`);
          // Generate a unique phone number for OAuth users (format: GOOGLE_<googleId>)
          const phoneNumber = `GOOGLE_${googleId}`;
          result = await db.query(
            `INSERT INTO profiles (email, full_name, google_id, provider_id, auth_provider, avatar_url, role, phone)
             VALUES ($1, $2, $3, $4, 'google', $5, 'customer', $6)
             RETURNING *`,
            [email, name, googleId, googleId, avatarUrl, phoneNumber]
          );
          console.log(`[Google Auth] New user created with ID: ${result.rows[0].id}`);
        } else {
          // Update existing user with Google info
          console.log(`[Google Auth] Updating existing user: ${email}`);
          // If user doesn't have a phone number, set one for OAuth users
          const existingUser = result.rows[0];
          const phoneNumber = existingUser.phone || `GOOGLE_${googleId}`;
          result = await db.query(
            `UPDATE profiles 
             SET google_id = $1, provider_id = $1, auth_provider = 'google', 
                 avatar_url = COALESCE($2, avatar_url), phone = COALESCE(phone, $3)
             WHERE email = $4 
             RETURNING *`,
            [googleId, avatarUrl, phoneNumber, email]
          );
          console.log(`[Google Auth] User updated with ID: ${result.rows[0].id}`);
        }
      } else {
        // User found by provider_id/google_id - ensure phone exists
        const existingUser = result.rows[0];
        if (!existingUser.phone) {
          // Set phone if missing
          const phoneNumber = `GOOGLE_${googleId}`;
          result = await db.query(
            `UPDATE profiles 
             SET phone = $1, updated_at = NOW()
             WHERE id = $2 
             RETURNING *`,
            [phoneNumber, existingUser.id]
          );
        } else {
          // Update provider_id if not set (migration helper)
          if (!existingUser.provider_id) {
            result = await db.query(
              `UPDATE profiles 
               SET provider_id = $1, auth_provider = 'google', avatar_url = COALESCE(avatar_url, $2)
               WHERE id = $3 
               RETURNING *`,
              [googleId, avatarUrl, existingUser.id]
            );
          } else if (avatarUrl && existingUser.avatar_url !== avatarUrl) {
            // Update avatar if changed
            result = await db.query(
              `UPDATE profiles SET avatar_url = $1 WHERE id = $2 RETURNING *`,
              [avatarUrl, existingUser.id]
            );
          }
        }
      }

      const user = result.rows[0];
      console.log(`[Google Auth] Authentication successful for user: ${user.email}, ID: ${user.id}`);
      return done(null, user);
    } catch (error) {
      console.error('[Google Auth] Error during authentication:', error);
      return done(error, null);
    }
  }
));

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

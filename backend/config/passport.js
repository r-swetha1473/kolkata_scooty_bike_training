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
          result = await db.query(
            `INSERT INTO profiles (email, full_name, google_id, provider_id, auth_provider, avatar_url, role)
             VALUES ($1, $2, $3, $4, 'google', $5, 'customer')
             RETURNING *`,
            [email, name, googleId, googleId, avatarUrl]
          );
        } else {
          // Update existing user with Google info
          result = await db.query(
            `UPDATE profiles 
             SET google_id = $1, provider_id = $1, auth_provider = 'google', avatar_url = $2 
             WHERE email = $3 
             RETURNING *`,
            [googleId, avatarUrl, email]
          );
        }
      } else {
        // Update provider_id if not set (migration helper)
        if (!result.rows[0].provider_id) {
          result = await db.query(
            `UPDATE profiles 
             SET provider_id = $1, auth_provider = 'google', avatar_url = COALESCE(avatar_url, $2)
             WHERE id = $3 
             RETURNING *`,
            [googleId, avatarUrl, result.rows[0].id]
          );
        } else if (avatarUrl && result.rows[0].avatar_url !== avatarUrl) {
          // Update avatar if changed
          result = await db.query(
            `UPDATE profiles SET avatar_url = $1 WHERE id = $2 RETURNING *`,
            [avatarUrl, result.rows[0].id]
          );
        }
      }

      return done(null, result.rows[0]);
    } catch (error) {
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

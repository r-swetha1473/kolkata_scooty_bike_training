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

      let result = await db.query(
        'SELECT * FROM profiles WHERE google_id = $1',
        [googleId]
      );

      if (result.rows.length === 0) {
        result = await db.query(
          'SELECT * FROM profiles WHERE email = $1',
          [email]
        );

        if (result.rows.length === 0) {
          result = await db.query(
            `INSERT INTO profiles (email, full_name, google_id, avatar_url, role)
             VALUES ($1, $2, $3, $4, 'customer')
             RETURNING *`,
            [email, name, googleId, avatarUrl]
          );
        } else {
          result = await db.query(
            'UPDATE profiles SET google_id = $1, avatar_url = $2 WHERE email = $3 RETURNING *',
            [googleId, avatarUrl, email]
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


import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import pool from '../config/db';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "MISSING_ID";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "MISSING_SECRET";
const CALLBACK_URL = process.env.CALLBACK_URL || "http://localhost:3001/auth/google/callback";

passport.serializeUser((user: any, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
    try {
        const res = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
        if (res.rows.length > 0) {
            done(null, res.rows[0]);
        } else {
            done(new Error("User not found"), null);
        }
    } catch (e) {
        done(e, null);
    }
});

// --- GOOGLE STRATEGY ---
// --- GOOGLE STRATEGY ---
passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Check if user exists
        const res = await pool.query("SELECT * FROM users WHERE id = $1", [profile.id]);

        if (res.rows.length === 0) {
            // Register new user
            const email = profile.emails?.[0]?.value || "";
            const photo = profile.photos?.[0]?.value || "";
            const name = profile.displayName || "Unknown";

            await pool.query(
                "INSERT INTO users (id, email, display_name, photo_url, refresh_token) VALUES ($1, $2, $3, $4, $5)",
                [profile.id, email, name, photo, refreshToken || null]
            );
            return done(null, { id: profile.id, email, display_name: name, photo_url: photo, refresh_token: refreshToken });
        } else {
            // Update last login & Refresh Token (if provided)
            if (refreshToken) {
                await pool.query("UPDATE users SET last_login = NOW(), refresh_token = $1 WHERE id = $2", [refreshToken, profile.id]);
            } else {
                await pool.query("UPDATE users SET last_login = NOW() WHERE id = $1", [profile.id]);
            }
            return done(null, res.rows[0]);
        }
    } catch (e) {
        return done(e, undefined);
    }
}));

// --- LOCAL STRATEGY (ADMIN) ---
passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
}, async (email, password, done) => {
    try {
        console.log(`🔐 Login Attempt: ${email}`);

        const res = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (res.rows.length === 0) {
            console.log("❌ User not found");
            return done(null, false, { message: 'Incorrect email.' });
        }

        const user = res.rows[0];
        if (!user.password_hash) {
            console.log("❌ No password hash (Google User?)");
            return done(null, false, { message: 'Please login with Google.' });
        }

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            console.log("❌ Password mismatch");
            return done(null, false, { message: 'Incorrect password.' });
        }

        console.log("✅ Login Success");
        return done(null, user);
    } catch (err) {
        console.error("❌ Login Error:", err);
        return done(err);
    }
}));

export default passport;

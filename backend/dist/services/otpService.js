"use strict";
/**
 * OTP Service - Generate, Store, and Verify OTPs
 *
 * Uses PostgreSQL to store hashed OTPs with expiry and attempt tracking.
 * Supports both phone and email OTPs.
 *
 * @module services/otpService
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateOTP = generateOTP;
exports.hashOTP = hashOTP;
exports.maskOTP = maskOTP;
exports.generateAndSendOtp = generateAndSendOtp;
exports.verifyOtp = verifyOtp;
const crypto_1 = __importDefault(require("crypto"));
const OTP_LENGTH = parseInt(process.env.OTP_LENGTH || '6');
const OTP_TTL_SECONDS = parseInt(process.env.OTP_TTL_SECONDS || '300');
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || '5');
/**
 * Generate a numeric OTP
 *
 * @param {number} length - OTP length (default: 6)
 * @returns {string} Numeric OTP
 */
function generateOTP(length = OTP_LENGTH) {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
}
/**
 * Hash OTP using SHA256
 *
 * @param {string} otp - Raw OTP
 * @returns {string} Hashed OTP (hex)
 */
function hashOTP(otp) {
    return crypto_1.default.createHash('sha256').update(otp).digest('hex');
}
/**
 * Mask OTP for logging (show only last 2 digits)
 *
 * @param {string} otp - Raw OTP
 * @returns {string} Masked OTP (e.g., "****56")
 */
function maskOTP(otp) {
    if (otp.length <= 2)
        return '**';
    return '*'.repeat(otp.length - 2) + otp.slice(-2);
}
/**
 * Ensure OTP table exists in database
 *
 * @param {Pool} pool - Database pool
 */
async function ensureOTPTable(pool) {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS otps (
      id SERIAL PRIMARY KEY,
      phone_or_email TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
    await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_otps_phone_email ON otps(phone_or_email)
  `);
    await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_otps_expires ON otps(expires_at)
  `);
    await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_otps_used ON otps(used) WHERE used = FALSE
  `);
    // Delete expired OTPs periodically (cleanup)
    try {
        await pool.query('DELETE FROM otps WHERE expires_at < NOW() AND used = FALSE');
    }
    catch (err) {
        // Ignore cleanup errors
    }
}
/**
 * Generate and send OTP
 *
 * @param {Pool} pool - Database pool
 * @param {string} phoneOrEmail - Phone number or email address
 * @param {Function} sendWhatsAppFn - Function to send WhatsApp OTP
 * @param {Function} sendEmailFn - Function to send Email OTP (fallback)
 * @returns {Promise<{ok: boolean, otp?: string, error?: any}>}
 */
async function generateAndSendOtp(pool, phoneOrEmail, sendWhatsAppFn, sendEmailFn) {
    try {
        await ensureOTPTable(pool);
        // Normalize phone/email
        const normalized = phoneOrEmail.toLowerCase().trim();
        const isPhone = /^\d{10,15}$/.test(normalized.replace(/[\s+\-()]/g, ''));
        const normalizedPhone = isPhone ? normalized.replace(/[\s+\-()]/g, '') : normalized;
        // Generate OTP
        const otp = generateOTP(OTP_LENGTH);
        const otpHash = hashOTP(otp);
        const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);
        // Delete existing unused OTPs for this phone/email
        await pool.query('DELETE FROM otps WHERE phone_or_email = $1 AND used = FALSE', [normalizedPhone]);
        // Store hashed OTP
        await pool.query(`INSERT INTO otps (phone_or_email, otp_hash, expires_at)
       VALUES ($1, $2, $3)`, [normalizedPhone, otpHash, expiresAt]);
        console.log(`✅ OTP generated for ${isPhone ? 'phone' : 'email'}: ${isPhone ? normalizedPhone : normalized.substring(0, 3) + '***'}, OTP: ${maskOTP(otp)}`);
        // Send OTP
        let sent = false;
        if (isPhone && sendWhatsAppFn) {
            try {
                const result = await sendWhatsAppFn(normalizedPhone, otp);
                if (result.ok || result.success) {
                    sent = true;
                    console.log(`✅ OTP sent via WhatsApp to ${normalizedPhone}`);
                }
            }
            catch (err) {
                console.error('❌ Failed to send OTP via WhatsApp:', err.message);
            }
        }
        // Fallback to email if WhatsApp failed or if it's an email
        if (!sent && sendEmailFn) {
            try {
                await sendEmailFn(normalized, otp);
                sent = true;
                console.log(`✅ OTP sent via Email to ${normalized.substring(0, 3) + '***'}`);
            }
            catch (err) {
                console.error('❌ Failed to send OTP via Email:', err.message);
            }
        }
        if (!sent) {
            return { ok: false, error: { message: 'Failed to send OTP via any method' } };
        }
        return { ok: true, otp: otp }; // Return OTP for testing, but never log it
    }
    catch (error) {
        console.error('❌ Error generating OTP:', error);
        return { ok: false, error: { message: error.message } };
    }
}
/**
 * Verify OTP
 *
 * @param {Pool} pool - Database pool
 * @param {string} phoneOrEmail - Phone number or email address
 * @param {string} rawOtp - Raw OTP from user
 * @returns {Promise<{ok: boolean, userId?: number, error?: any}>}
 */
async function verifyOtp(pool, phoneOrEmail, rawOtp) {
    try {
        await ensureOTPTable(pool);
        // Normalize phone/email
        const normalized = phoneOrEmail.toLowerCase().trim();
        const isPhone = /^\d{10,15}$/.test(normalized.replace(/[\s+\-()]/g, ''));
        const normalizedPhone = isPhone ? normalized.replace(/[\s+\-()]/g, '') : normalized;
        // Hash provided OTP
        const providedHash = hashOTP(rawOtp);
        // Find unused OTP record
        const result = await pool.query(`SELECT id, otp_hash, attempts, expires_at, created_at
       FROM otps
       WHERE phone_or_email = $1 AND used = FALSE
       ORDER BY created_at DESC
       LIMIT 1`, [normalizedPhone]);
        if (result.rows.length === 0) {
            return { ok: false, error: { message: 'OTP not found or already used' } };
        }
        const otpRecord = result.rows[0];
        // Check expiry
        if (new Date(otpRecord.expires_at) < new Date()) {
            await pool.query('UPDATE otps SET used = TRUE WHERE id = $1', [otpRecord.id]);
            return { ok: false, error: { message: 'OTP has expired' } };
        }
        // Check attempts
        if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
            await pool.query('UPDATE otps SET used = TRUE WHERE id = $1', [otpRecord.id]);
            return { ok: false, error: { message: 'Maximum attempts exceeded' } };
        }
        // Verify hash (constant-time comparison)
        const storedHash = otpRecord.otp_hash;
        const isValid = crypto_1.default.timingSafeEqual(Buffer.from(providedHash, 'hex'), Buffer.from(storedHash, 'hex'));
        if (!isValid) {
            // Increment attempts
            await pool.query('UPDATE otps SET attempts = attempts + 1 WHERE id = $1', [otpRecord.id]);
            return { ok: false, error: { message: 'Invalid OTP' } };
        }
        // Mark as used
        await pool.query('UPDATE otps SET used = TRUE WHERE id = $1', [otpRecord.id]);
        // Try to find user by phone or email
        let userId;
        try {
            const userResult = await pool.query('SELECT id FROM users WHERE phone = $1 OR email = $2 LIMIT 1', [normalizedPhone, normalized]);
            if (userResult.rows.length > 0) {
                userId = userResult.rows[0].id;
            }
        }
        catch (userErr) {
            // User lookup failed, but OTP is valid
            console.warn('Could not find user for OTP verification:', userErr);
        }
        console.log(`✅ OTP verified for ${isPhone ? 'phone' : 'email'}: ${isPhone ? normalizedPhone : normalized.substring(0, 3) + '***'}`);
        return { ok: true, userId };
    }
    catch (error) {
        console.error('❌ Error verifying OTP:', error);
        return { ok: false, error: { message: error.message } };
    }
}

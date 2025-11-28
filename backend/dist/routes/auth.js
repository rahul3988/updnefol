"use strict";
/**
 * Authentication Routes - Password Reset System
 *
 * This module handles:
 * - Forgot password request
 * - Password reset with secure token
 *
 * @module routes/auth
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.forgotPassword = forgotPassword;
exports.resetPassword = resetPassword;
const crypto_1 = __importDefault(require("crypto"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const apiHelpers_1 = require("../utils/apiHelpers");
const emailService_1 = require("../services/emailService");
const SALT_ROUNDS = 10;
const TOKEN_BYTES = 32;
const TOKEN_EXPIRY_MINUTES = 15;
/**
 * Generate a secure random token for password reset
 * @returns {string} Raw token (32 bytes, hex encoded = 64 chars)
 */
function generateResetToken() {
    return crypto_1.default.randomBytes(TOKEN_BYTES).toString('hex');
}
/**
 * Hash a token using SHA256 for database storage
 * @param {string} token - Raw token
 * @returns {string} Hashed token
 */
function hashToken(token) {
    return crypto_1.default.createHash('sha256').update(token).digest('hex');
}
/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
    return await bcrypt_1.default.hash(password, SALT_ROUNDS);
}
/**
 * Verify a password against a bcrypt hash
 * @param {string} password - Plain text password
 * @param {string} hash - Bcrypt hash
 * @returns {Promise<boolean>} True if password matches
 */
async function verifyPassword(password, hash) {
    return await bcrypt_1.default.compare(password, hash);
}
/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {string|null} Error message if invalid, null if valid
 */
function validatePasswordStrength(password) {
    if (!password || password.length === 0) {
        return 'Password is required';
    }
    if (password.length < 8) {
        return 'Password must be at least 8 characters long';
    }
    if (password.length > 128) {
        return 'Password must be less than 128 characters';
    }
    // Basic strength check - at least one letter and one number
    if (!/[a-zA-Z]/.test(password)) {
        return 'Password must contain at least one letter';
    }
    if (!/[0-9]/.test(password)) {
        return 'Password must contain at least one number';
    }
    return null;
}
/**
 * Forgot Password - Request password reset
 *
 * POST /api/auth/forgot-password
 * Body: { "email": "user@example.com" }
 *
 * @param {Pool} pool - Database pool
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function forgotPassword(pool, req, res) {
    try {
        const { email } = req.body;
        console.log('🔐 Forgot password request:', { email });
        // Validate required fields
        const validationError = (0, apiHelpers_1.validateRequired)(req.body, ['email']);
        if (validationError) {
            return (0, apiHelpers_1.sendError)(res, 400, validationError);
        }
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return (0, apiHelpers_1.sendError)(res, 400, 'Invalid email format');
        }
        // Find user by email
        const { rows } = await pool.query('SELECT id, name, email FROM users WHERE LOWER(email) = LOWER($1)', [email]);
        // Always return success to prevent email enumeration
        // But only send email if user exists
        if (rows.length > 0) {
            const user = rows[0];
            // Generate secure reset token
            const rawToken = generateResetToken();
            const hashedToken = hashToken(rawToken);
            // Set expiry to 15 minutes from now
            const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);
            // Save hashed token and expiry to database
            await pool.query(`UPDATE users 
         SET reset_password_token = $1, 
             reset_password_expires = $2,
             updated_at = NOW()
         WHERE id = $3`, [hashedToken, expiresAt, user.id]);
            // Build reset link
            const frontendUrl = process.env.USER_PANEL_URL || process.env.CLIENT_ORIGIN || 'https://thenefol.com';
            const resetLink = `${frontendUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;
            // Send password reset email
            try {
                await (0, emailService_1.sendPasswordResetEmail)(email, user.name || 'User', resetLink);
                console.log(`✅ Password reset email sent to: ${email}`);
            }
            catch (emailErr) {
                console.error('❌ Failed to send password reset email:', emailErr);
                // Don't fail the request if email fails - token is still saved
            }
            // Log password reset request
            console.log(`✅ Password reset token generated for user: ${user.id} (${email})`);
        }
        else {
            console.log(`⚠️  Password reset requested for non-existent email: ${email}`);
        }
        // Always return success to prevent email enumeration attacks
        (0, apiHelpers_1.sendSuccess)(res, {
            message: 'If an account with that email exists, a password reset link has been sent.'
        });
    }
    catch (err) {
        console.error('❌ Error in forgot password:', err);
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to process password reset request', err);
    }
}
/**
 * Reset Password - Reset password using token
 *
 * POST /api/auth/reset-password
 * Body: {
 *   "email": "user@example.com",
 *   "token": "raw_token_from_email",
 *   "newPassword": "NewSecurePass123"
 * }
 *
 * @param {Pool} pool - Database pool
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function resetPassword(pool, req, res) {
    try {
        const { email, token, newPassword } = req.body;
        console.log('🔐 Reset password request:', { email, tokenLength: token?.length || 0 });
        // Validate required fields
        const validationError = (0, apiHelpers_1.validateRequired)(req.body, ['email', 'token', 'newPassword']);
        if (validationError) {
            return (0, apiHelpers_1.sendError)(res, 400, validationError);
        }
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return (0, apiHelpers_1.sendError)(res, 400, 'Invalid email format');
        }
        // Validate password strength
        const passwordError = validatePasswordStrength(newPassword);
        if (passwordError) {
            return (0, apiHelpers_1.sendError)(res, 400, passwordError);
        }
        // Validate token format (should be 64 hex characters for 32 bytes)
        if (!token || token.length !== 64 || !/^[0-9a-fA-F]+$/.test(token)) {
            return (0, apiHelpers_1.sendError)(res, 400, 'Invalid or malformed reset token');
        }
        // Hash the provided token to compare with stored hash
        const hashedToken = hashToken(token);
        // Find user with matching email and token
        const { rows } = await pool.query(`SELECT id, name, email, reset_password_token, reset_password_expires 
       FROM users 
       WHERE LOWER(email) = LOWER($1) 
       AND reset_password_token = $2`, [email, hashedToken]);
        if (rows.length === 0) {
            console.error('❌ Invalid reset token or email');
            return (0, apiHelpers_1.sendError)(res, 400, 'Invalid or expired reset token');
        }
        const user = rows[0];
        // Check if token has expired
        if (!user.reset_password_expires || new Date(user.reset_password_expires) < new Date()) {
            // Clear expired token
            await pool.query(`UPDATE users 
         SET reset_password_token = NULL, 
             reset_password_expires = NULL,
             updated_at = NOW()
         WHERE id = $1`, [user.id]);
            console.error('❌ Reset token expired for user:', user.id);
            return (0, apiHelpers_1.sendError)(res, 400, 'Reset token has expired. Please request a new one.');
        }
        // Hash the new password
        const hashedPassword = await hashPassword(newPassword);
        // Update password and clear reset token fields
        await pool.query(`UPDATE users 
       SET password = $1,
           reset_password_token = NULL,
           reset_password_expires = NULL,
           updated_at = NOW()
       WHERE id = $2`, [hashedPassword, user.id]);
        console.log(`✅ Password reset successful for user: ${user.id} (${email})`);
        (0, apiHelpers_1.sendSuccess)(res, {
            message: 'Password has been reset successfully. You can now login with your new password.'
        });
    }
    catch (err) {
        console.error('❌ Error in reset password:', err);
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to reset password', err);
    }
}

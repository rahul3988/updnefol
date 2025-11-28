"use strict";
/**
 * OTP Routes - WhatsApp + Email OTP System
 *
 * This module handles OTP generation, sending (via WhatsApp and Email),
 * and verification for user authentication.
 *
 * @module routes/otp
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOTP = sendOTP;
exports.verifyOTP = verifyOTP;
const apiHelpers_1 = require("../utils/apiHelpers");
const whatsappService_1 = require("../services/whatsappService");
const email_1 = require("../utils/email");
/**
 * Send OTP via WhatsApp (primary) and Email (secondary)
 *
 * POST /api/otp/send
 * Body: { "phone": "91XXXXXXXXXX" }
 *
 * @param {Pool} pool - Database pool
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function sendOTP(pool, req, res) {
    try {
        const { phone } = req.body;
        console.log('📱 OTP Request received:', { phone, raw: req.body });
        const validationError = (0, apiHelpers_1.validateRequired)(req.body, ['phone']);
        if (validationError) {
            return (0, apiHelpers_1.sendError)(res, 400, validationError);
        }
        // Normalize phone number (remove spaces, +, etc.)
        const normalizedPhone = phone.replace(/[\s+\-()]/g, '');
        console.log('📱 Normalized phone:', normalizedPhone);
        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        // Set expiration to 10 minutes from now
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        // Delete any existing OTPs for this phone
        await pool.query('DELETE FROM otp_verifications WHERE phone = $1', [normalizedPhone]);
        // Store OTP in database
        await pool.query(`
      INSERT INTO otp_verifications (phone, otp, expires_at)
      VALUES ($1, $2, $3)
    `, [normalizedPhone, otp, expiresAt]);
        // Initialize WhatsApp service
        const whatsappService = new whatsappService_1.WhatsAppService(pool);
        // Send OTP via WhatsApp (primary)
        let whatsappSent = false;
        try {
            const whatsappResult = await whatsappService.sendOTP(normalizedPhone, otp);
            if (whatsappResult.success) {
                whatsappSent = true;
                console.log('✅ OTP sent via WhatsApp to:', normalizedPhone);
            }
            else {
                console.error('❌ Failed to send OTP via WhatsApp:', whatsappResult.error);
            }
        }
        catch (whatsappErr) {
            console.error('❌ WhatsApp OTP send error:', whatsappErr.message);
        }
        // Send OTP via Email (secondary) - try to get email from user record
        let emailSent = false;
        try {
            const userResult = await pool.query('SELECT email, name FROM users WHERE phone = $1', [normalizedPhone]);
            if (userResult.rows.length > 0 && userResult.rows[0].email) {
                const userEmail = userResult.rows[0].email;
                const userName = userResult.rows[0].name || 'User';
                const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>OTP Verification</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #667eea; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: #fff; margin: 0;">OTP Verification</h1>
            </div>
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-bottom: 20px;">Hi ${userName},</p>
              <p style="font-size: 16px; margin-bottom: 20px;">Your verification code is:</p>
              <div style="background: #fff; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
                <h2 style="color: #667eea; font-size: 32px; margin: 0; letter-spacing: 5px;">${otp}</h2>
              </div>
              <p style="font-size: 14px; color: #666; margin-top: 20px;">This code will expire in 10 minutes. Do NOT share this code with anyone.</p>
              <p style="font-size: 14px; color: #666; margin-top: 20px;">If you didn't request this code, please ignore this email.</p>
            </div>
          </body>
          </html>
        `;
                await email_1.transporter.sendMail({
                    from: `"Thenefol" <${(0, email_1.getAdminEmail)()}>`,
                    to: userEmail,
                    subject: 'OTP Verification - Thenefol',
                    html: emailHtml
                });
                emailSent = true;
                console.log('✅ OTP sent via Email to:', userEmail);
            }
            else {
                console.log('ℹ️  No email found for phone:', normalizedPhone, '- skipping email OTP');
            }
        }
        catch (emailErr) {
            console.error('❌ Email OTP send error:', emailErr.message);
        }
        // Return success if at least one method succeeded
        if (whatsappSent || emailSent) {
            (0, apiHelpers_1.sendSuccess)(res, {
                message: whatsappSent
                    ? 'OTP sent successfully to your WhatsApp'
                    : 'OTP sent successfully to your email',
                method: whatsappSent ? 'whatsapp' : 'email',
                expiresIn: 600 // 10 minutes in seconds
            });
        }
        else {
            return (0, apiHelpers_1.sendError)(res, 500, 'Failed to send OTP via WhatsApp or Email. Please try again.');
        }
    }
    catch (err) {
        console.error('❌ Error sending OTP:', err);
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to send OTP', err);
    }
}
/**
 * Verify OTP
 *
 * POST /api/otp/verify
 * Body: { "phone": "91XXXXXXXXXX", "otp": "123456" }
 *
 * @param {Pool} pool - Database pool
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function verifyOTP(pool, req, res) {
    try {
        const { phone, otp } = req.body;
        const validationError = (0, apiHelpers_1.validateRequired)(req.body, ['phone', 'otp']);
        if (validationError) {
            return (0, apiHelpers_1.sendError)(res, 400, validationError);
        }
        // Normalize phone number
        const normalizedPhone = phone.replace(/[\s+\-()]/g, '');
        // Find the OTP record
        const { rows } = await pool.query(`
      SELECT * FROM otp_verifications
      WHERE phone = $1 AND verified = false
      ORDER BY created_at DESC
      LIMIT 1
    `, [normalizedPhone]);
        if (rows.length === 0) {
            return (0, apiHelpers_1.sendError)(res, 400, 'OTP not found or already used. Please request a new OTP.');
        }
        const otpRecord = rows[0];
        // Check if OTP is expired
        if (new Date(otpRecord.expires_at) < new Date()) {
            await pool.query('DELETE FROM otp_verifications WHERE id = $1', [otpRecord.id]);
            return (0, apiHelpers_1.sendError)(res, 400, 'OTP has expired. Please request a new one.');
        }
        // Check if too many attempts
        if (otpRecord.attempts >= 5) {
            await pool.query('DELETE FROM otp_verifications WHERE id = $1', [otpRecord.id]);
            return (0, apiHelpers_1.sendError)(res, 400, 'Too many failed attempts. Please request a new OTP.');
        }
        // Verify OTP
        if (otpRecord.otp !== otp) {
            // Increment attempts
            await pool.query('UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1', [otpRecord.id]);
            return (0, apiHelpers_1.sendError)(res, 400, 'Invalid OTP. Please try again.');
        }
        // Mark OTP as verified
        await pool.query('UPDATE otp_verifications SET verified = true WHERE id = $1', [otpRecord.id]);
        console.log('✅ OTP verified successfully for phone:', normalizedPhone);
        (0, apiHelpers_1.sendSuccess)(res, {
            message: 'OTP verified successfully',
            verified: true
        });
    }
    catch (err) {
        console.error('❌ Error verifying OTP:', err);
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to verify OTP', err);
    }
}

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
const otpService_1 = require("../services/otpService");
/**
 * Send OTP via WhatsApp (primary) and Email (secondary)
 *
 * POST /api/auth/send-otp
 * Body: { "phone": "91XXXXXXXXXX" } or { "email": "user@example.com" }
 *
 * @param {Pool} pool - Database pool
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function sendOTP(pool, req, res) {
    try {
        const { phone, email } = req.body;
        console.log('📱 OTP Request received:', { phone: phone ? '***' : undefined, email: email ? email.substring(0, 3) + '***' : undefined });
        if (!phone && !email) {
            return (0, apiHelpers_1.sendError)(res, 400, 'Either phone or email is required');
        }
        const phoneOrEmail = phone || email;
        const whatsappService = new whatsappService_1.WhatsAppService(pool);
        // Email fallback function
        const sendEmailOtp = async (emailAddr, otp) => {
            try {
                const userResult = await pool.query('SELECT name FROM users WHERE email = $1', [emailAddr]);
                const userName = userResult.rows[0]?.name || 'User';
                const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"><title>OTP Verification</title></head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #667eea; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: #fff; margin: 0;">OTP Verification</h1>
            </div>
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px;">Hi ${userName},</p>
              <p style="font-size: 16px;">Your verification code is:</p>
              <div style="background: #fff; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
                <h2 style="color: #667eea; font-size: 32px; margin: 0; letter-spacing: 5px;">${otp}</h2>
              </div>
              <p style="font-size: 14px; color: #666;">This code will expire in ${Math.ceil(parseInt(process.env.OTP_TTL_SECONDS || '300') / 60)} minutes.</p>
            </div>
          </body>
          </html>
        `;
                await email_1.transporter.sendMail({
                    from: `"Thenefol" <${(0, email_1.getAdminEmail)()}>`,
                    to: emailAddr,
                    subject: 'OTP Verification - Thenefol',
                    html: emailHtml
                });
            }
            catch (err) {
                throw new Error(`Email send failed: ${err.message}`);
            }
        };
        // WhatsApp send function
        // Meta automatically generates OTP - no need to pass otp parameter
        const sendWhatsAppOtp = async (phoneNum, otp) => {
            // OTP parameter is ignored - Meta generates it automatically via nefol_otp_auth template
            const result = await whatsappService.sendOTPWhatsApp(phoneNum);
            if (!result.ok) {
                throw new Error(result.error?.message || 'WhatsApp send failed');
            }
            return result;
        };
        // Generate and send OTP
        const result = await (0, otpService_1.generateAndSendOtp)(pool, phoneOrEmail, phone ? sendWhatsAppOtp : undefined, email ? sendEmailOtp : undefined);
        if (!result.ok) {
            return (0, apiHelpers_1.sendError)(res, 500, result.error?.message || 'Failed to send OTP');
        }
        const otpTtl = parseInt(process.env.OTP_TTL_SECONDS || '300');
        (0, apiHelpers_1.sendSuccess)(res, {
            message: phone ? 'OTP sent successfully to your WhatsApp' : 'OTP sent successfully to your email',
            method: phone ? 'whatsapp' : 'email',
            expiresIn: otpTtl
        });
    }
    catch (err) {
        console.error('❌ Error sending OTP:', err);
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to send OTP', err);
    }
}
/**
 * Verify OTP
 *
 * POST /api/auth/verify-otp
 * Body: { "phone": "91XXXXXXXXXX", "otp": "123456" } or { "email": "user@example.com", "otp": "123456" }
 *
 * @param {Pool} pool - Database pool
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function verifyOTP(pool, req, res) {
    try {
        const { phone, email, otp } = req.body;
        if (!phone && !email) {
            return (0, apiHelpers_1.sendError)(res, 400, 'Either phone or email is required');
        }
        if (!otp) {
            return (0, apiHelpers_1.sendError)(res, 400, 'OTP is required');
        }
        const phoneOrEmail = phone || email;
        // Verify OTP using service
        const result = await (0, otpService_1.verifyOtp)(pool, phoneOrEmail, otp);
        if (!result.ok) {
            return (0, apiHelpers_1.sendError)(res, 400, result.error?.message || 'OTP verification failed');
        }
        console.log(`✅ OTP verified successfully for ${phone ? 'phone' : 'email'}: ${phone ? phone.replace(/.(?=.{4})/g, '*') : email.substring(0, 3) + '***'}`);
        (0, apiHelpers_1.sendSuccess)(res, {
            message: 'OTP verified successfully',
            verified: true,
            userId: result.userId
        });
    }
    catch (err) {
        console.error('❌ Error verifying OTP:', err);
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to verify OTP', err);
    }
}

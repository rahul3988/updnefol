"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transporter = void 0;
exports.verifyEmailConfig = verifyEmailConfig;
exports.getAdminEmail = getAdminEmail;
// Email Configuration with Nodemailer + Hostinger SMTP
const nodemailer_1 = __importDefault(require("nodemailer"));
// Create and export Nodemailer transporter with Hostinger SMTP
exports.transporter = nodemailer_1.default.createTransport({
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});
// Verify transporter configuration
async function verifyEmailConfig() {
    try {
        await exports.transporter.verify();
        console.log('✅ Email transporter configured successfully');
        return true;
    }
    catch (error) {
        console.error('❌ Email transporter configuration failed:', error);
        return false;
    }
}
// Get admin email from environment or use default
function getAdminEmail() {
    return process.env.EMAIL_USER || 'support@thenefol.com';
}

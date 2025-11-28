"use strict";
/**
 * WhatsApp Business Cloud API Service
 *
 * This service class provides methods for sending WhatsApp messages,
 * handling OTPs, order notifications, templates, and processing webhooks.
 *
 * @module services/whatsappService
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppService = void 0;
exports.createWhatsAppService = createWhatsAppService;
const whatsapp_1 = require("../config/whatsapp");
const whatsappUtils_1 = require("../utils/whatsappUtils");
const whatsappTemplateHelper_1 = require("../utils/whatsappTemplateHelper");
/**
 * WhatsApp Service Class
 * Provides all WhatsApp Business API functionality
 */
class WhatsAppService {
    constructor(pool) {
        this.pool = pool;
    }
    /**
     * Send a simple text message via WhatsApp
     *
     * @param {string} to - Recipient phone number (with country code, no spaces)
     * @param {string} message - Text message to send
     * @returns {Promise<{success: boolean, data?: any, error?: string}>}
     *
     * @example
     * const service = new WhatsAppService(pool)
     * const result = await service.sendText('919876543210', 'Hello!')
     */
    async sendText(to, message) {
        try {
            return await (0, whatsappUtils_1.sendWhatsAppMessage)(to, message, this.pool);
        }
        catch (error) {
            console.error('Error in sendText:', error);
            return {
                success: false,
                error: error.message || 'Failed to send WhatsApp message'
            };
        }
    }
    /**
     * Send OTP via WhatsApp using nefol_otp_auth template
     * Template: nefol_otp_auth (Meta's "Copy Code" authentication template)
     * Variables: None - Meta automatically generates and sends the OTP code
     *
     * @param {string} phone - Recipient phone number
     * @returns {Promise<{ok: boolean, providerId?: string, fallbackUsed?: boolean, error?: any}>}
     */
    async sendOTPWhatsApp(phone) {
        try {
            // nefol_otp_auth uses Meta's "Copy Code" OTP format - zero variables, zero buttons
            // Meta automatically generates OTP and enables zero-tap auto-fill
            // No backend OTP generation - do not pass variables parameter
            // The template helper will omit the components field entirely for this template
            const result = await (0, whatsappTemplateHelper_1.sendWhatsAppTemplate)(phone, 'nefol_otp_auth', undefined, 'en');
            if (result.ok) {
                return { ok: true, providerId: result.providerId };
            }
            // Log error only - no fallback for authentication templates
            console.error('❌ WhatsApp OTP template send failed:', result.error?.message);
            return { ok: false, error: result.error };
        }
        catch (error) {
            // Log error only
            console.error('❌ Error in sendOTPWhatsApp:', error.message);
            return { ok: false, error: { message: error.message } };
        }
    }
    /**
     * Send OTP via WhatsApp (legacy method, uses template)
     * Meta automatically generates the OTP - no backend generation needed
     *
     * @param {string} to - Recipient phone number
     * @param {string} otp - OTP parameter (ignored - Meta generates OTP automatically)
     * @returns {Promise<{success: boolean, data?: any, error?: string}>}
     */
    async sendOTP(to, otp) {
        // Call sendOTPWhatsApp without passing otp - Meta generates it automatically
        const result = await this.sendOTPWhatsApp(to);
        return {
            success: result.ok,
            data: result.providerId ? { messageId: result.providerId } : undefined,
            error: result.error?.message
        };
    }
    /**
     * Send a template message via WhatsApp
     *
     * @param {string} to - Recipient phone number
     * @param {string} templateName - Template name (must be approved in Meta Business)
     * @param {string} languageCode - Language code (e.g., 'en', 'hi_IN')
     * @param {Array} components - Template components (body parameters, buttons, etc.)
     * @returns {Promise<{success: boolean, data?: any, error?: string}>}
     *
     * @example
     * const service = new WhatsAppService(pool)
     * const result = await service.sendTemplate(
     *   '919876543210',
     *   'otp_verification',
     *   'en',
     *   [{
     *     type: 'body',
     *     parameters: [{ type: 'text', text: '123456' }]
     *   }]
     * )
     */
    async sendTemplate(to, templateName, languageCode = 'en', components = []) {
        try {
            const phoneNumberId = (0, whatsapp_1.getPhoneNumberId)();
            const endpoint = `/${phoneNumberId}/messages`;
            const requestBody = {
                messaging_product: 'whatsapp',
                to: to,
                type: 'template',
                template: {
                    name: templateName,
                    language: {
                        code: languageCode
                    },
                    components: components
                }
            };
            const response = await (0, whatsapp_1.whatsappRequest)(endpoint, {
                method: 'POST',
                body: JSON.stringify(requestBody)
            });
            // Log to database if pool is available
            if (this.pool) {
                try {
                    const customerName = `Customer_${to}`;
                    const lastMessage = `Template: ${templateName}`;
                    const updateResult = await this.pool.query(`
            UPDATE whatsapp_chat_sessions
            SET 
              last_message = $1,
              last_message_time = NOW(),
              status = 'active',
              message_count = COALESCE(message_count, 0) + 1,
              updated_at = NOW()
            WHERE customer_phone = $2
          `, [lastMessage, to]);
                    if (updateResult.rowCount === 0) {
                        await this.pool.query(`
              INSERT INTO whatsapp_chat_sessions (customer_name, customer_phone, last_message, last_message_time, status, message_count)
              VALUES ($1, $2, $3, NOW(), 'active', 1)
            `, [customerName, to, lastMessage]);
                    }
                }
                catch (dbErr) {
                    console.error('Failed to log template message to database:', dbErr.message);
                }
            }
            return {
                success: true,
                data: response
            };
        }
        catch (error) {
            console.error('Error in sendTemplate:', error);
            return {
                success: false,
                error: error.message || 'Failed to send template message'
            };
        }
    }
    /**
     * Send order notification via WhatsApp
     * Format: "Hi {name}, your order #{orderId} is confirmed. Total: ₹{total}. Items: {items}"
     *
     * @param {string} to - Recipient phone number
     * @param {Object} orderObject - Order object with name, orderId, total, items
     * @returns {Promise<{success: boolean, data?: any, error?: string}>}
     *
     * @example
     * const service = new WhatsAppService(pool)
     * const result = await service.sendOrderNotification('919876543210', {
     *   name: 'Rahul',
     *   orderId: 'NF12345',
     *   total: 899,
     *   items: ['Item 1', 'Item 2']
     * })
     */
    async sendOrderNotification(to, orderObject) {
        try {
            const itemsList = orderObject.items.join(', ');
            const message = `Hi ${orderObject.name}, your order #${orderObject.orderId} is confirmed. Total: ₹${orderObject.total}. Items: ${itemsList}`;
            return await this.sendText(to, message);
        }
        catch (error) {
            console.error('Error in sendOrderNotification:', error);
            return {
                success: false,
                error: error.message || 'Failed to send order notification'
            };
        }
    }
    /**
     * Handle incoming message from webhook
     * Parses contacts, messages, and message types (text, button, interactive)
     *
     * @param {Object} payload - Webhook payload from Meta
     * @returns {Promise<void>}
     *
     * @example
     * const service = new WhatsAppService(pool)
     * await service.handleIncomingMessage({
     *   id: 'wamid.xxx',
     *   from: '919876543210',
     *   type: 'text',
     *   text: { body: 'Hello' },
     *   timestamp: '1234567890'
     * })
     */
    async handleIncomingMessage(payload) {
        try {
            if (!this.pool) {
                console.error('Database pool not available for handling incoming message');
                return;
            }
            const { processIncomingMessage } = await Promise.resolve().then(() => __importStar(require('../utils/whatsappUtils')));
            await processIncomingMessage(this.pool, payload);
        }
        catch (error) {
            console.error('Error in handleIncomingMessage:', error);
            throw error;
        }
    }
    /**
     * Handle status update from webhook
     * Handles delivery, read, and failed events
     *
     * @param {Object} payload - Status update payload from Meta
     * @returns {Promise<void>}
     *
     * @example
     * const service = new WhatsAppService(pool)
     * await service.handleStatusUpdate({
     *   id: 'wamid.xxx',
     *   status: 'delivered',
     *   timestamp: '1234567890',
     *   recipient_id: '919876543210'
     * })
     */
    async handleStatusUpdate(payload) {
        try {
            if (!this.pool) {
                console.error('Database pool not available for handling status update');
                return;
            }
            const { processStatusUpdate } = await Promise.resolve().then(() => __importStar(require('../utils/whatsappUtils')));
            await processStatusUpdate(this.pool, payload);
        }
        catch (error) {
            console.error('Error in handleStatusUpdate:', error);
            throw error;
        }
    }
    /**
     * Send password reset code via WhatsApp using nefol_reset_password template
     * Template: nefol_reset_password
     * Variables: [resetCode] - Only 1 parameter (reset code)
     *
     * @param {string} phone - Recipient phone number
     * @param {string} code - Reset code (6-digit OTP)
     * @param {string} name - User name (optional)
     * @returns {Promise<{ok: boolean, providerId?: string, fallbackUsed?: boolean, error?: any}>}
     */
    async sendResetPasswordWhatsApp(phone, code, name = '') {
        try {
            // Template expects 1 parameter (reset code)
            // Authentication templates must use en and NO fallback to plain text
            const variables = [
                { type: 'text', text: code }
            ];
            const result = await (0, whatsappTemplateHelper_1.sendWhatsAppTemplate)(phone, 'nefol_reset_password', variables, 'en');
            if (result.ok) {
                return { ok: true, providerId: result.providerId };
            }
            // NO fallback to plain text for authentication templates
            // Return error to caller - they must handle it
            return { ok: false, error: result.error };
        }
        catch (error) {
            console.error('Error in sendResetPasswordWhatsApp:', error);
            return { ok: false, error: { message: error.message } };
        }
    }
    /**
     * Send signup success message via WhatsApp using nefol_signup_success template
     * Template: nefol_signup_success
     * Variables: [name]
     *
     * @param {any} user - User object with name, phone, email
     * @returns {Promise<{ok: boolean, providerId?: string, fallbackUsed?: boolean, error?: any}>}
     */
    async sendSignupWhatsApp(user) {
        try {
            if (!user.phone) {
                return { ok: false, error: { message: 'User phone number not available' } };
            }
            const variables = [
                { type: 'text', text: user.name || 'User' }
            ];
            // Authentication templates must use en and NO fallback to plain text
            const result = await (0, whatsappTemplateHelper_1.sendWhatsAppTemplate)(user.phone, 'nefol_signup_success', variables, 'en');
            if (result.ok) {
                return { ok: true, providerId: result.providerId };
            }
            // NO fallback to plain text for authentication templates
            return { ok: false, error: result.error };
        }
        catch (error) {
            console.error('Error in sendSignupWhatsApp:', error);
            return { ok: false, error: { message: error.message } };
        }
    }
    /**
     * Send login alert via WhatsApp using nefol_login_alert template
     * Template: nefol_login_alert
     * Variables: [name, deviceInfo, timestamp]
     *
     * @param {any} user - User object with name, phone
     * @param {string} deviceInfo - Device/browser information
     * @returns {Promise<{ok: boolean, providerId?: string, fallbackUsed?: boolean, error?: any}>}
     */
    async sendLoginAlertWhatsApp(user, deviceInfo = 'Unknown device') {
        try {
            if (!user.phone) {
                return { ok: false, error: { message: 'User phone number not available' } };
            }
            const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
            const variables = [
                { type: 'text', text: user.name || 'User' },
                { type: 'text', text: deviceInfo },
                { type: 'text', text: timestamp }
            ];
            // Authentication templates must use en and NO fallback to plain text
            const result = await (0, whatsappTemplateHelper_1.sendWhatsAppTemplate)(user.phone, 'nefol_login_alert', variables, 'en');
            if (result.ok) {
                return { ok: true, providerId: result.providerId };
            }
            // NO fallback to plain text for authentication templates
            return { ok: false, error: result.error };
        }
        catch (error) {
            console.error('Error in sendLoginAlertWhatsApp:', error);
            return { ok: false, error: { message: error.message } };
        }
    }
    /**
     * Send cart recovery message via WhatsApp using nefol_cart_recover template
     * Template: nefol_cart_recover
     * Variables: [name, cartUrl]
     *
     * @param {any} user - User object with name, phone
     * @param {string} cartUrl - URL to view cart
     * @returns {Promise<{ok: boolean, providerId?: string, fallbackUsed?: boolean, error?: any}>}
     */
    async sendCartRecoveryWhatsApp(user, cartUrl) {
        try {
            if (!user.phone) {
                return { ok: false, error: { message: 'User phone number not available' } };
            }
            const frontendUrl = process.env.FRONTEND_URL || process.env.USER_PANEL_URL || 'https://thenefol.com';
            const fullCartUrl = cartUrl.startsWith('http') ? cartUrl : `${frontendUrl}${cartUrl.startsWith('/') ? '' : '/'}${cartUrl}`;
            const variables = [
                { type: 'text', text: user.name || 'User' },
                { type: 'text', text: fullCartUrl }
            ];
            const result = await (0, whatsappTemplateHelper_1.sendWhatsAppTemplate)(user.phone, 'nefol_cart_recover', variables);
            if (result.ok) {
                return { ok: true, providerId: result.providerId };
            }
            // Fallback to plain text
            if (result.error?.isTemplateError) {
                const fallbackResult = await this.sendText(user.phone, `Hi ${user.name}, you have items in your cart. Complete your purchase: ${fullCartUrl}`);
                return {
                    ok: fallbackResult.success,
                    providerId: fallbackResult.data?.messages?.[0]?.id,
                    fallbackUsed: true
                };
            }
            return { ok: false, error: result.error };
        }
        catch (error) {
            console.error('Error in sendCartRecoveryWhatsApp:', error);
            return { ok: false, error: { message: error.message } };
        }
    }
    /**
     * Send order shipped notification via WhatsApp using nefol_order_shipped template
     * Template: nefol_order_shipped
     * Variables: [name, orderId, trackingUrl]
     *
     * @param {any} user - User object with name, phone
     * @param {string} orderId - Order ID
     * @param {string} tracking - Tracking URL or number
     * @returns {Promise<{ok: boolean, providerId?: string, fallbackUsed?: boolean, error?: any}>}
     */
    async sendOrderShippedWhatsApp(user, orderId, tracking) {
        try {
            if (!user.phone) {
                return { ok: false, error: { message: 'User phone number not available' } };
            }
            const variables = [
                { type: 'text', text: user.name || 'User' },
                { type: 'text', text: orderId },
                { type: 'text', text: tracking }
            ];
            const result = await (0, whatsappTemplateHelper_1.sendWhatsAppTemplate)(user.phone, 'nefol_order_shipped', variables);
            if (result.ok) {
                return { ok: true, providerId: result.providerId };
            }
            // Fallback to plain text
            if (result.error?.isTemplateError) {
                const fallbackResult = await this.sendText(user.phone, `Hi ${user.name}, your order #${orderId} has been shipped! Track: ${tracking}`);
                return {
                    ok: fallbackResult.success,
                    providerId: fallbackResult.data?.messages?.[0]?.id,
                    fallbackUsed: true
                };
            }
            return { ok: false, error: result.error };
        }
        catch (error) {
            console.error('Error in sendOrderShippedWhatsApp:', error);
            return { ok: false, error: { message: error.message } };
        }
    }
    /**
     * Send order delivered notification via WhatsApp using nefol_order_delivered template
     * Template: nefol_order_delivered
     * Variables: [name, orderId]
     *
     * @param {any} user - User object with name, phone
     * @param {string} orderId - Order ID
     * @returns {Promise<{ok: boolean, providerId?: string, fallbackUsed?: boolean, error?: any}>}
     */
    async sendOrderDeliveredWhatsApp(user, orderId) {
        try {
            if (!user.phone) {
                return { ok: false, error: { message: 'User phone number not available' } };
            }
            const variables = [
                { type: 'text', text: user.name || 'User' },
                { type: 'text', text: orderId }
            ];
            const result = await (0, whatsappTemplateHelper_1.sendWhatsAppTemplate)(user.phone, 'nefol_order_delivered', variables);
            if (result.ok) {
                return { ok: true, providerId: result.providerId };
            }
            // Fallback to plain text
            if (result.error?.isTemplateError) {
                const fallbackResult = await this.sendText(user.phone, `Hi ${user.name}, your order #${orderId} has been delivered! Thank you for shopping with us.`);
                return {
                    ok: fallbackResult.success,
                    providerId: fallbackResult.data?.messages?.[0]?.id,
                    fallbackUsed: true
                };
            }
            return { ok: false, error: result.error };
        }
        catch (error) {
            console.error('Error in sendOrderDeliveredWhatsApp:', error);
            return { ok: false, error: { message: error.message } };
        }
    }
    /**
     * Send refund notification via WhatsApp using nefol_refund_1 template
     * Template: nefol_refund_1
     * Variables: [name, orderId, amount]
     *
     * @param {any} user - User object with name, phone
     * @param {string} orderId - Order ID
     * @param {number} amount - Refund amount
     * @returns {Promise<{ok: boolean, providerId?: string, fallbackUsed?: boolean, error?: any}>}
     */
    async sendRefundWhatsApp(user, orderId, amount) {
        try {
            if (!user.phone) {
                return { ok: false, error: { message: 'User phone number not available' } };
            }
            const variables = [
                { type: 'text', text: user.name || 'User' },
                { type: 'text', text: orderId },
                { type: 'text', text: `₹${amount}` }
            ];
            const result = await (0, whatsappTemplateHelper_1.sendWhatsAppTemplate)(user.phone, 'nefol_refund_1', variables);
            if (result.ok) {
                return { ok: true, providerId: result.providerId };
            }
            // Fallback to plain text
            if (result.error?.isTemplateError) {
                const fallbackResult = await this.sendText(user.phone, `Hi ${user.name}, refund of ₹${amount} for order #${orderId} has been processed.`);
                return {
                    ok: fallbackResult.success,
                    providerId: fallbackResult.data?.messages?.[0]?.id,
                    fallbackUsed: true
                };
            }
            return { ok: false, error: result.error };
        }
        catch (error) {
            console.error('Error in sendRefundWhatsApp:', error);
            return { ok: false, error: { message: error.message } };
        }
    }
    /**
     * Send COD verification request via WhatsApp using nefol_cod_verify template
     * Template: nefol_cod_verify
     * Variables: [name, orderId, amount]
     *
     * @param {any} user - User object with name, phone
     * @param {string} orderId - Order ID
     * @returns {Promise<{ok: boolean, providerId?: string, fallbackUsed?: boolean, error?: any}>}
     */
    async sendCODVerifyWhatsApp(user, orderId) {
        try {
            if (!user.phone) {
                return { ok: false, error: { message: 'User phone number not available' } };
            }
            // Get order amount from database if pool available
            let orderAmount = '₹0';
            if (this.pool) {
                try {
                    // Try to match by order_number (string) or id (integer)
                    const orderResult = await this.pool.query('SELECT total FROM orders WHERE order_number = $1 OR id::text = $1', [orderId]);
                    if (orderResult.rows.length > 0) {
                        orderAmount = `₹${orderResult.rows[0].total || 0}`;
                    }
                }
                catch (dbErr) {
                    console.error('Failed to fetch order amount:', dbErr);
                }
            }
            const variables = [
                { type: 'text', text: user.name || 'User' },
                { type: 'text', text: orderId },
                { type: 'text', text: orderAmount }
            ];
            const result = await (0, whatsappTemplateHelper_1.sendWhatsAppTemplate)(user.phone, 'nefol_cod_verify', variables);
            if (result.ok) {
                return { ok: true, providerId: result.providerId };
            }
            // Fallback to plain text
            if (result.error?.isTemplateError) {
                const fallbackResult = await this.sendText(user.phone, `Hi ${user.name}, please confirm your COD order #${orderId} for ${orderAmount}. Reply YES to confirm or NO to cancel.`);
                return {
                    ok: fallbackResult.success,
                    providerId: fallbackResult.data?.messages?.[0]?.id,
                    fallbackUsed: true
                };
            }
            return { ok: false, error: result.error };
        }
        catch (error) {
            console.error('Error in sendCODVerifyWhatsApp:', error);
            return { ok: false, error: { message: error.message } };
        }
    }
    /**
     * Send greeting message via WhatsApp using nefol_greet_1 template
     * Template: nefol_greet_1
     * Variables: [name]
     *
     * @param {any} user - User object with name, phone
     * @returns {Promise<{ok: boolean, providerId?: string, fallbackUsed?: boolean, error?: any}>}
     */
    async sendGreetingWhatsApp(user) {
        try {
            if (!user.phone) {
                return { ok: false, error: { message: 'User phone number not available' } };
            }
            const variables = [
                { type: 'text', text: user.name || 'User' }
            ];
            // Authentication templates must use en and NO fallback to plain text
            const result = await (0, whatsappTemplateHelper_1.sendWhatsAppTemplate)(user.phone, 'nefol_greet_1', variables, 'en');
            if (result.ok) {
                return { ok: true, providerId: result.providerId };
            }
            // NO fallback to plain text for authentication templates
            return { ok: false, error: result.error };
        }
        catch (error) {
            console.error('Error in sendGreetingWhatsApp:', error);
            return { ok: false, error: { message: error.message } };
        }
    }
    /**
     * Send welcome message via WhatsApp using nefol_welcome_1 template
     * Template: nefol_welcome_1
     * Variables: [name]
     *
     * @param {any} user - User object with name, phone
     * @returns {Promise<{ok: boolean, providerId?: string, fallbackUsed?: boolean, error?: any}>}
     */
    async sendWelcomeWhatsApp(user) {
        try {
            if (!user.phone) {
                return { ok: false, error: { message: 'User phone number not available' } };
            }
            const variables = [
                { type: 'text', text: user.name || 'User' }
            ];
            // Authentication templates must use en and NO fallback to plain text
            const result = await (0, whatsappTemplateHelper_1.sendWhatsAppTemplate)(user.phone, 'nefol_welcome_1', variables, 'en');
            if (result.ok) {
                return { ok: true, providerId: result.providerId };
            }
            // NO fallback to plain text for authentication templates
            return { ok: false, error: result.error };
        }
        catch (error) {
            console.error('Error in sendWelcomeWhatsApp:', error);
            return { ok: false, error: { message: error.message } };
        }
    }
}
exports.WhatsAppService = WhatsAppService;
/**
 * Create a WhatsApp service instance
 *
 * @param {Pool} pool - Database pool (optional)
 * @returns {WhatsAppService}
 */
function createWhatsAppService(pool) {
    return new WhatsAppService(pool);
}

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
     * Send OTP via WhatsApp
     * Format: "Your verification code is {otp}. Valid for 10 minutes. Do NOT share."
     *
     * @param {string} to - Recipient phone number
     * @param {string} otp - 6-digit OTP code
     * @returns {Promise<{success: boolean, data?: any, error?: string}>}
     *
     * @example
     * const service = new WhatsAppService(pool)
     * const result = await service.sendOTP('919876543210', '123456')
     */
    async sendOTP(to, otp) {
        try {
            const message = `Your verification code is ${otp}. Valid for 10 minutes. Do NOT share.`;
            return await this.sendText(to, message);
        }
        catch (error) {
            console.error('Error in sendOTP:', error);
            return {
                success: false,
                error: error.message || 'Failed to send OTP via WhatsApp'
            };
        }
    }
    /**
     * Send a template message via WhatsApp
     *
     * @param {string} to - Recipient phone number
     * @param {string} templateName - Template name (must be approved in Meta Business)
     * @param {string} languageCode - Language code (e.g., 'en_US', 'hi_IN')
     * @param {Array} components - Template components (body parameters, buttons, etc.)
     * @returns {Promise<{success: boolean, data?: any, error?: string}>}
     *
     * @example
     * const service = new WhatsAppService(pool)
     * const result = await service.sendTemplate(
     *   '919876543210',
     *   'otp_verification',
     *   'en_US',
     *   [{
     *     type: 'body',
     *     parameters: [{ type: 'text', text: '123456' }]
     *   }]
     * )
     */
    async sendTemplate(to, templateName, languageCode = 'en_US', components = []) {
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

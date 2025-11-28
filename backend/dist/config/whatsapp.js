"use strict";
/**
 * WhatsApp Business Cloud API Configuration
 *
 * This module provides configuration and utility functions for interacting
 * with Meta's WhatsApp Business Cloud API.
 *
 * @module config/whatsapp
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWhatsAppApiUrl = getWhatsAppApiUrl;
exports.getPhoneNumberId = getPhoneNumberId;
exports.getAccessToken = getAccessToken;
exports.getWhatsAppHeaders = getWhatsAppHeaders;
exports.whatsappRequest = whatsappRequest;
exports.verifyWebhookSignature = verifyWebhookSignature;
/**
 * Get the base API URL for WhatsApp Business Cloud API
 * Defaults to v17.0 if not specified in environment
 *
 * @returns {string} Base API URL
 */
function getWhatsAppApiUrl() {
    const apiUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v17.0';
    return apiUrl;
}
/**
 * Get the phone number ID from environment
 *
 * @returns {string} Phone number ID
 * @throws {Error} If phone number ID is not configured
 */
function getPhoneNumberId() {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!phoneNumberId) {
        throw new Error('WHATSAPP_PHONE_NUMBER_ID is not configured in environment variables');
    }
    return phoneNumberId;
}
/**
 * Get the access token from environment
 * Uses WHATSAPP_TOKEN or WHATSAPP_ACCESS_TOKEN for backward compatibility
 *
 * @returns {string} Access token
 * @throws {Error} If access token is not configured
 */
function getAccessToken() {
    const token = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
    if (!token) {
        throw new Error('WHATSAPP_TOKEN or WHATSAPP_ACCESS_TOKEN is not configured in environment variables');
    }
    return token;
}
/**
 * Get headers for WhatsApp API requests
 * Includes Authorization Bearer token and Content-Type
 *
 * @returns {Record<string, string>} Request headers
 */
function getWhatsAppHeaders() {
    const token = getAccessToken();
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}
/**
 * Generic request function for WhatsApp API calls
 * Handles errors, logging, and response parsing
 *
 * @param {string} endpoint - API endpoint (relative to base URL)
 * @param {RequestInit} options - Fetch options (method, body, etc.)
 * @returns {Promise<any>} Response data
 * @throws {Error} If request fails
 *
 * @example
 * const response = await whatsappRequest('/123456789/messages', {
 *   method: 'POST',
 *   body: JSON.stringify({ messaging_product: 'whatsapp', ... })
 * })
 */
async function whatsappRequest(endpoint, options = {}) {
    const baseUrl = getWhatsAppApiUrl();
    const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
    const headers = getWhatsAppHeaders();
    // Merge headers
    const requestOptions = {
        ...options,
        headers: {
            ...headers,
            ...(options.headers || {})
        }
    };
    try {
        console.log(`📤 WhatsApp API Request: ${options.method || 'GET'} ${url}`);
        const response = await fetch(url, requestOptions);
        const responseData = await response.json();
        if (!response.ok) {
            const errorMessage = responseData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
            const errorCode = responseData.error?.code || response.status;
            console.error(`❌ WhatsApp API Error [${errorCode}]:`, errorMessage);
            console.error('   Response:', JSON.stringify(responseData, null, 2));
            throw new Error(`WhatsApp API Error [${errorCode}]: ${errorMessage}`);
        }
        console.log(`✅ WhatsApp API Success: ${options.method || 'GET'} ${url}`);
        return responseData;
    }
    catch (error) {
        // Re-throw if it's already our formatted error
        if (error.message && error.message.includes('WhatsApp API Error')) {
            throw error;
        }
        // Handle network errors
        console.error(`❌ WhatsApp API Request Failed: ${error.message}`);
        throw new Error(`WhatsApp API Request Failed: ${error.message}`);
    }
}
/**
 * Verify webhook signature from Meta
 *
 * @param {string | Buffer} payload - Raw request body
 * @param {string} signature - X-Hub-Signature-256 header value
 * @param {string} appSecret - WhatsApp App Secret
 * @returns {boolean} True if signature is valid
 */
function verifyWebhookSignature(payload, signature, appSecret) {
    const crypto = require('crypto');
    try {
        // Signature format: sha256=<hash>
        if (!signature.startsWith('sha256=')) {
            console.error('Invalid signature format');
            return false;
        }
        const expectedSignature = signature.substring(7); // Remove 'sha256=' prefix
        // Convert payload to string if it's a Buffer
        const payloadString = Buffer.isBuffer(payload)
            ? payload.toString('utf-8')
            : typeof payload === 'string'
                ? payload
                : JSON.stringify(payload);
        // Calculate HMAC SHA256
        const hmac = crypto.createHmac('sha256', appSecret);
        hmac.update(payloadString);
        const calculatedSignature = hmac.digest('hex');
        // Compare signatures using constant-time comparison
        const isValid = crypto.timingSafeEqual(Buffer.from(expectedSignature, 'hex'), Buffer.from(calculatedSignature, 'hex'));
        if (!isValid) {
            console.error('Signature mismatch');
            console.error('Expected:', calculatedSignature);
            console.error('Received:', expectedSignature);
        }
        return isValid;
    }
    catch (err) {
        console.error('Error verifying webhook signature:', err);
        return false;
    }
}

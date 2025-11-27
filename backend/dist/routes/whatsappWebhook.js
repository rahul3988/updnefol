"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWebhook = exports.verifyWebhook = void 0;
const whatsappUtils_1 = require("../utils/whatsappUtils");
/**
 * GET endpoint for Meta webhook verification
 * Meta sends: hub.mode, hub.verify_token, hub.challenge
 * We verify the token and return the challenge
 */
const verifyWebhook = async (req, res) => {
    try {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
        if (!verifyToken) {
            console.error('❌ WHATSAPP_VERIFY_TOKEN not configured in environment');
            return res.status(500).send('Webhook verification token not configured');
        }
        // Verify the mode and token
        if (mode === 'subscribe' && token === verifyToken) {
            console.log('✅ WhatsApp webhook verified successfully');
            return res.status(200).send(challenge);
        }
        else {
            console.error('❌ WhatsApp webhook verification failed');
            console.error('   Expected token:', verifyToken);
            console.error('   Received token:', token);
            console.error('   Mode:', mode);
            return res.status(403).send('Forbidden');
        }
    }
    catch (err) {
        console.error('Webhook verification error:', err);
        return res.status(500).send('Internal server error');
    }
};
exports.verifyWebhook = verifyWebhook;
/**
 * POST endpoint to receive incoming messages and status updates
 * Handles:
 * - Incoming messages (text, image, document, etc.)
 * - Message status updates (sent, delivered, read, failed)
 */
const handleWebhook = async (pool, req, res) => {
    try {
        // Get raw body for signature verification (express.raw() middleware provides Buffer)
        const rawBody = req.body;
        const bodyString = rawBody.toString('utf-8');
        // Verify webhook signature for security
        const signature = req.headers['x-hub-signature-256'];
        if (!signature) {
            console.error('❌ Missing X-Hub-Signature-256 header');
            return res.status(401).json({ error: 'Missing signature' });
        }
        const appSecret = process.env.WHATSAPP_APP_SECRET;
        if (!appSecret) {
            console.error('❌ WHATSAPP_APP_SECRET not configured');
            // In development, we might skip signature verification
            // In production, this should be required
            console.warn('⚠️  Proceeding without signature verification (not recommended for production)');
        }
        else {
            const isValid = (0, whatsappUtils_1.verifyWebhookSignature)(bodyString, signature, appSecret);
            if (!isValid) {
                console.error('❌ Invalid webhook signature');
                return res.status(401).json({ error: 'Invalid signature' });
            }
        }
        // Parse JSON body
        const body = JSON.parse(bodyString);
        // Meta webhook payload structure:
        // {
        //   "object": "whatsapp_business_account",
        //   "entry": [{
        //     "changes": [{
        //       "value": {
        //         "messaging_product": "whatsapp",
        //         "messages": [...], // incoming messages
        //         "statuses": [...]   // status updates
        //       }
        //     }]
        //   }]
        // }
        if (body.object !== 'whatsapp_business_account') {
            console.log('⚠️  Received webhook for non-WhatsApp object:', body.object);
            return res.status(200).json({ status: 'ignored' });
        }
        // Process each entry
        if (body.entry && Array.isArray(body.entry)) {
            for (const entry of body.entry) {
                if (entry.changes && Array.isArray(entry.changes)) {
                    for (const change of entry.changes) {
                        const value = change.value;
                        if (!value || value.messaging_product !== 'whatsapp') {
                            continue;
                        }
                        // Process incoming messages
                        if (value.messages && Array.isArray(value.messages)) {
                            for (const message of value.messages) {
                                try {
                                    await (0, whatsappUtils_1.processIncomingMessage)(pool, message, value.metadata);
                                }
                                catch (err) {
                                    console.error('Error processing incoming message:', err);
                                    // Continue processing other messages even if one fails
                                }
                            }
                        }
                        // Process status updates
                        if (value.statuses && Array.isArray(value.statuses)) {
                            for (const status of value.statuses) {
                                try {
                                    await (0, whatsappUtils_1.processStatusUpdate)(pool, status);
                                }
                                catch (err) {
                                    console.error('Error processing status update:', err);
                                    // Continue processing other statuses even if one fails
                                }
                            }
                        }
                    }
                }
            }
        }
        // Always return 200 OK to acknowledge receipt
        // Meta will retry if we return an error
        return res.status(200).json({ status: 'ok' });
    }
    catch (err) {
        console.error('Webhook handler error:', err);
        // Still return 200 to prevent Meta from retrying
        // Log the error for debugging
        return res.status(200).json({ status: 'error', message: err.message });
    }
};
exports.handleWebhook = handleWebhook;

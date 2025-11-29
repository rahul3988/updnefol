"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCart = getCart;
exports.addToCart = addToCart;
exports.updateCartItem = updateCartItem;
exports.removeFromCart = removeFromCart;
exports.clearCart = clearCart;
exports.login = login;
exports.register = register;
exports.sendOTP = sendOTP;
exports.verifyOTPSignup = verifyOTPSignup;
exports.sendOTPLogin = sendOTPLogin;
exports.verifyOTPLogin = verifyOTPLogin;
exports.getUserProfile = getUserProfile;
exports.updateUserProfile = updateUserProfile;
exports.getUserAddresses = getUserAddresses;
exports.createUserAddress = createUserAddress;
exports.updateUserAddress = updateUserAddress;
exports.deleteUserAddress = deleteUserAddress;
exports.setDefaultAddress = setDefaultAddress;
const bcrypt_1 = __importDefault(require("bcrypt"));
const apiHelpers_1 = require("../utils/apiHelpers");
const userActivitySchema_1 = require("../utils/userActivitySchema");
const emailService_1 = require("../services/emailService");
const whatsappService_1 = require("../services/whatsappService");
const otpService_1 = require("../services/otpService");
const SALT_ROUNDS = 10;
// Optimized GET /api/cart
async function getCart(pool, req, res) {
    try {
        const userId = req.userId; // Set by authenticateToken middleware
        const { rows } = await pool.query(`
      SELECT c.*, p.title, p.price, p.list_image, p.slug, p.details, p.category
      FROM cart c
      JOIN products p ON c.product_id = p.id
      WHERE c.user_id = $1
      ORDER BY c.created_at DESC
    `, [userId]);
        // Transform the data to match frontend expectations
        const transformedRows = rows.map((row) => {
            const details = row.details || {};
            let finalPrice = row.price;
            // Use discounted price if available
            if (details.mrp && details.websitePrice) {
                finalPrice = details.websitePrice;
            }
            // Ensure MRP is properly extracted and converted to string
            const mrpValue = details.mrp || null;
            return {
                id: row.id,
                product_id: row.product_id,
                slug: row.slug,
                title: row.title,
                price: String(finalPrice), // Convert to string as frontend expects (this is websitePrice)
                image: row.list_image, // Rename list_image to image
                quantity: row.quantity,
                category: row.category,
                mrp: mrpValue ? String(mrpValue) : null, // Ensure MRP is string and not null if exists
                discounted_price: details.websitePrice ? String(details.websitePrice) : null,
                original_price: String(row.price),
                details: details, // Include full details object for frontend access
                csvProduct: details,
                created_at: row.created_at,
                updated_at: row.updated_at
            };
        });
        (0, apiHelpers_1.sendSuccess)(res, transformedRows);
    }
    catch (err) {
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to fetch cart', err);
    }
}
// Optimized POST /api/cart
async function addToCart(pool, req, res) {
    try {
        const userId = req.userId;
        const { product_id, quantity = 1 } = req.body;
        // Validate required fields
        const validationError = (0, apiHelpers_1.validateRequired)(req.body, ['product_id']);
        if (validationError) {
            return (0, apiHelpers_1.sendError)(res, 400, validationError);
        }
        // Check if product exists
        const productCheck = await pool.query('SELECT id FROM products WHERE id = $1', [product_id]);
        if (productCheck.rows.length === 0) {
            return (0, apiHelpers_1.sendError)(res, 404, 'Product not found');
        }
        // Check if item already exists in cart
        const existingItem = await pool.query('SELECT * FROM cart WHERE user_id = $1 AND product_id = $2', [userId, product_id]);
        if (existingItem.rows.length > 0) {
            // Update quantity
            const { rows } = await pool.query(`
        UPDATE cart 
        SET quantity = quantity + $1, updated_at = NOW()
        WHERE user_id = $2 AND product_id = $3
        RETURNING *
      `, [quantity, userId, product_id]);
            (0, apiHelpers_1.sendSuccess)(res, rows[0]);
        }
        else {
            // Add new item
            const { rows } = await pool.query(`
        INSERT INTO cart (user_id, product_id, quantity)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [userId, product_id, quantity]);
            (0, apiHelpers_1.sendSuccess)(res, rows[0], 201);
        }
        // Log cart activity
        const productData = await pool.query('SELECT title, price FROM products WHERE id = $1', [product_id]);
        if (productData.rows.length > 0) {
            await (0, userActivitySchema_1.logUserActivity)(pool, {
                user_id: parseInt(userId),
                activity_type: 'cart',
                activity_subtype: 'add',
                product_id,
                product_name: productData.rows[0].title,
                product_price: productData.rows[0].price,
                quantity,
                user_agent: req.headers['user-agent'],
                ip_address: req.ip || req.connection.remoteAddress
            });
            // Send cart reminder email (async, don't wait)
            // Only send if this is a new item (not an update to existing)
            if (existingItem.rows.length === 0) {
                const userData = await pool.query('SELECT email, name FROM users WHERE id = $1', [userId]);
                if (userData.rows.length > 0 && userData.rows[0].email) {
                    (0, emailService_1.sendCartAddedEmail)(userData.rows[0].email, userData.rows[0].name || 'Customer', productData.rows[0].title, parseFloat(productData.rows[0].price)).catch(err => {
                        console.error('Failed to send cart reminder email:', err);
                    });
                }
            }
        }
    }
    catch (err) {
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to add to cart', err);
    }
}
// Optimized PUT /api/cart/:cartItemId
async function updateCartItem(pool, req, res) {
    try {
        const { cartItemId } = req.params;
        const { quantity } = req.body;
        const userId = req.userId;
        if (quantity === undefined || quantity < 0) {
            return (0, apiHelpers_1.sendError)(res, 400, 'Valid quantity is required');
        }
        if (quantity === 0) {
            // Remove item from cart
            const { rows } = await pool.query(`
        DELETE FROM cart 
        WHERE id = $1 AND user_id = $2
        RETURNING *
      `, [cartItemId, userId]);
            if (rows.length === 0) {
                return (0, apiHelpers_1.sendError)(res, 404, 'Cart item not found');
            }
            (0, apiHelpers_1.sendSuccess)(res, { message: 'Item removed from cart' });
        }
        else {
            // Update quantity
            const { rows } = await pool.query(`
        UPDATE cart 
        SET quantity = $1, updated_at = NOW()
        WHERE id = $2 AND user_id = $3
        RETURNING *
      `, [quantity, cartItemId, userId]);
            if (rows.length === 0) {
                return (0, apiHelpers_1.sendError)(res, 404, 'Cart item not found');
            }
            (0, apiHelpers_1.sendSuccess)(res, rows[0]);
        }
    }
    catch (err) {
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to update cart item', err);
    }
}
// Optimized DELETE /api/cart/:cartItemId
async function removeFromCart(pool, req, res) {
    try {
        const { cartItemId } = req.params;
        const userId = req.userId;
        // Get item details before deletion for logging
        const itemData = await pool.query(`
      SELECT c.*, p.title, p.price 
      FROM cart c 
      JOIN products p ON c.product_id = p.id
      WHERE c.id = $1 AND c.user_id = $2
    `, [cartItemId, userId]);
        const { rows } = await pool.query(`
      DELETE FROM cart 
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [cartItemId, userId]);
        if (rows.length === 0) {
            return (0, apiHelpers_1.sendError)(res, 404, 'Cart item not found');
        }
        (0, apiHelpers_1.sendSuccess)(res, { message: 'Item removed from cart' });
        // Log cart removal activity
        if (itemData.rows.length > 0) {
            await (0, userActivitySchema_1.logUserActivity)(pool, {
                user_id: parseInt(userId),
                activity_type: 'cart',
                activity_subtype: 'remove',
                product_id: itemData.rows[0].product_id,
                product_name: itemData.rows[0].title,
                product_price: itemData.rows[0].price,
                quantity: itemData.rows[0].quantity,
                user_agent: req.headers['user-agent'],
                ip_address: req.ip || req.connection.remoteAddress
            });
        }
    }
    catch (err) {
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to remove cart item', err);
    }
}
// Clear entire cart
async function clearCart(pool, req, res) {
    try {
        const userId = req.userId;
        const { rows } = await pool.query(`
      DELETE FROM cart 
      WHERE user_id = $1
      RETURNING *
    `, [userId]);
        (0, apiHelpers_1.sendSuccess)(res, { message: 'Cart cleared successfully', removedItems: rows.length });
    }
    catch (err) {
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to clear cart', err);
    }
}
// Optimized authentication endpoints
async function login(pool, req, res) {
    try {
        const { email, password } = req.body;
        // Validate required fields
        const validationError = (0, apiHelpers_1.validateRequired)(req.body, ['email', 'password']);
        if (validationError) {
            return (0, apiHelpers_1.sendError)(res, 400, validationError);
        }
        // Find user by email
        const { rows } = await pool.query('SELECT id, name, email, password FROM users WHERE email = $1', [email]);
        if (rows.length === 0) {
            return (0, apiHelpers_1.sendError)(res, 401, 'Invalid credentials');
        }
        const user = rows[0];
        // Check password using bcrypt (with backward compatibility for plain text)
        let passwordValid = false;
        // Check if password is bcrypt hash (starts with $2a$, $2b$, or $2y$)
        if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$')) {
            // Password is hashed with bcrypt
            passwordValid = await bcrypt_1.default.compare(password, user.password);
        }
        else {
            // Backward compatibility: plain text password (migrate on successful login)
            if (user.password === password) {
                passwordValid = true;
                // Migrate to bcrypt hash on successful login
                const hashedPassword = await bcrypt_1.default.hash(password, SALT_ROUNDS);
                await pool.query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hashedPassword, user.id]);
                console.log(`✅ Migrated password to bcrypt for user: ${user.id}`);
            }
        }
        if (!passwordValid) {
            return (0, apiHelpers_1.sendError)(res, 401, 'Invalid credentials');
        }
        // Generate token
        const token = `user_token_${user.id}_${Date.now()}`;
        // Update last login
        await pool.query('UPDATE users SET updated_at = NOW() WHERE id = $1', [user.id]);
        (0, apiHelpers_1.sendSuccess)(res, {
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });
        const userAgent = req.headers['user-agent'];
        const ipAddress = req.ip || req.connection.remoteAddress;
        // Log login activity
        await (0, userActivitySchema_1.logUserActivity)(pool, {
            user_id: user.id,
            activity_type: 'auth',
            activity_subtype: 'login',
            user_agent: userAgent,
            ip_address: ipAddress
        });
        // Send login alert email (async, do not block response)
        if (user.email) {
            (0, emailService_1.sendLoginAlertEmail)(user.email, ipAddress, userAgent).catch(err => {
                console.error('Failed to send login alert email:', err);
            });
        }
    }
    catch (err) {
        (0, apiHelpers_1.sendError)(res, 500, 'Login failed', err);
    }
}
async function register(pool, req, res) {
    try {
        const { name, email, password, phone } = req.body;
        console.log('🔍 User registration attempt:', { name, email, phone });
        // Validate required fields
        const validationError = (0, apiHelpers_1.validateRequired)(req.body, ['name', 'email', 'password']);
        if (validationError) {
            console.log('❌ Validation error:', validationError);
            return (0, apiHelpers_1.sendError)(res, 400, validationError);
        }
        // Check if user already exists
        const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            console.log('❌ User already exists:', email);
            return (0, apiHelpers_1.sendError)(res, 409, 'User already exists');
        }
        console.log('✅ Creating new user...');
        // Hash password with bcrypt before storing
        const hashedPassword = await bcrypt_1.default.hash(password, SALT_ROUNDS);
        // Create new user
        const { rows } = await pool.query(`
      INSERT INTO users (name, email, password, phone, address)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, email, phone, created_at
    `, [name, email, hashedPassword, phone, req.body.address ? JSON.stringify(req.body.address) : null]);
        const user = rows[0];
        const token = `user_token_${user.id}_${Date.now()}`;
        console.log('✅ User created successfully:', user.email);
        // Send welcome email (async, don't wait)
        (0, emailService_1.sendWelcomeEmail)(user.email, user.name).catch(err => {
            console.error('Failed to send welcome email:', err);
        });
        // Send email verification OTP (async, don't wait)
        try {
            const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
            await (0, emailService_1.sendVerificationEmail)(user.email, rawOtp);
            console.log(`✅ Verification email OTP sent to: ${user.email}`);
        }
        catch (verr) {
            console.error('Failed to send verification email:', verr);
        }
        // Send WhatsApp signup success notification (async, don't wait)
        if (user.phone) {
            const whatsappService = new whatsappService_1.WhatsAppService(pool);
            whatsappService.sendSignupWhatsApp({
                name: user.name,
                phone: user.phone,
                email: user.email
            }).catch(err => {
                console.error('Failed to send WhatsApp signup notification:', err);
            });
            // Also send welcome WhatsApp message
            whatsappService.sendWelcomeWhatsApp({
                name: user.name,
                phone: user.phone
            }).catch(err => {
                console.error('Failed to send WhatsApp welcome message:', err);
            });
        }
        // If address is provided, create a default address
        if (req.body.address && req.body.address.street) {
            try {
                // Ensure user_addresses table exists
                await pool.query(`
          CREATE TABLE IF NOT EXISTS user_addresses (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(255),
            phone VARCHAR(20),
            street TEXT NOT NULL,
            area TEXT,
            landmark TEXT,
            city VARCHAR(100) NOT NULL,
            state VARCHAR(100) NOT NULL,
            zip VARCHAR(20) NOT NULL,
            country VARCHAR(100) DEFAULT 'India',
            address_type VARCHAR(20) DEFAULT 'house',
            address_label VARCHAR(100),
            is_default BOOLEAN DEFAULT false,
            delivery_instructions TEXT,
            weekend_delivery JSONB,
            is_house_type BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
                // Unset any existing defaults
                await pool.query(`
          UPDATE user_addresses SET is_default = false WHERE user_id = $1
        `, [user.id]);
                // Create default address
                await pool.query(`
          INSERT INTO user_addresses (user_id, name, phone, street, city, state, zip, country, address_type, is_default)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
        `, [
                    user.id,
                    name,
                    phone,
                    req.body.address.street || '',
                    req.body.address.city || '',
                    req.body.address.state || '',
                    req.body.address.zip || '',
                    'India',
                    'house'
                ]);
                console.log('✅ Default address created for user:', user.email);
            }
            catch (addrErr) {
                console.error('⚠️ Error creating default address:', addrErr);
                // Don't fail registration if address creation fails
            }
        }
        (0, apiHelpers_1.sendSuccess)(res, {
            token,
            user
        }, 201);
        // Log registration activity
        await (0, userActivitySchema_1.logUserActivity)(pool, {
            user_id: user.id,
            activity_type: 'auth',
            activity_subtype: 'register',
            user_agent: req.headers['user-agent'],
            ip_address: req.ip || req.connection.remoteAddress
        });
    }
    catch (err) {
        console.error('❌ Registration error:', err);
        if (err?.code === '23505') {
            (0, apiHelpers_1.sendError)(res, 409, 'User already exists');
        }
        else {
            (0, apiHelpers_1.sendError)(res, 500, 'Registration failed', err);
        }
    }
}
// Send OTP via WhatsApp for signup
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
        // Check if user already exists
        const existingUser = await pool.query('SELECT id FROM users WHERE phone = $1', [normalizedPhone]);
        if (existingUser.rows.length > 0) {
            return (0, apiHelpers_1.sendError)(res, 409, 'User with this phone number already exists');
        }
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
        // Get WhatsApp credentials from environment
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        if (!accessToken || !phoneNumberId) {
            console.error('❌ WhatsApp credentials not configured');
            console.error('   Missing:', !accessToken ? 'WHATSAPP_ACCESS_TOKEN' : '', !phoneNumberId ? 'WHATSAPP_PHONE_NUMBER_ID' : '');
            return (0, apiHelpers_1.sendError)(res, 500, 'WhatsApp service not configured. Please check your environment variables.');
        }
        // Send OTP via WhatsApp
        // Try template first, fallback to text message
        // Use nefol_login_otp template for login (same structure as nefol_verify_code)
        const templateName = process.env.WHATSAPP_LOGIN_OTP_TEMPLATE_NAME || 'nefol_login_otp';
        const templateLanguage = process.env.WHATSAPP_OTP_TEMPLATE_LANGUAGE || 'en';
        const useTemplate = process.env.WHATSAPP_USE_TEMPLATE === 'true';
        const facebookUrl = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;
        let requestBody;
        if (useTemplate) {
            // Use template message (works without 24-hour session)
            // Get contact info from env or use default
            // Note: Template expects phone number format for {{2}} parameter (max 20 chars)
            const contactInfo = process.env.WHATSAPP_CONTACT_INFO || '918887847213';
            // Build parameters array based on template requirements
            const bodyParameters = [
                {
                    type: 'text',
                    text: otp
                }
            ];
            // If template requires contact info (2nd parameter), add it
            // Check if we should send 2 parameters (some templates have {{2}} for contact)
            const sendContactInfo = process.env.WHATSAPP_TEMPLATE_HAS_CONTACT === 'true';
            if (sendContactInfo) {
                // Normalize contact info - remove spaces, +, dashes, etc.
                // Template expects phone number format (digits only, max 20 chars)
                const normalizedContact = contactInfo.replace(/[\s+\-()]/g, '').substring(0, 20);
                bodyParameters.push({
                    type: 'text',
                    text: normalizedContact
                });
            }
            // Build components array
            const components = [
                {
                    type: 'body',
                    parameters: bodyParameters
                }
            ];
            // Check if template has buttons that require parameters
            // URL buttons require a parameter (the URL)
            // IMPORTANT: WhatsApp button URL parameters have a 15-character limit
            // IMPORTANT: Button parameters must be plain text (domain only), NOT full URLs
            const buttonUrl = process.env.WHATSAPP_BUTTON_URL || 'thenefol.com';
            const hasButton = process.env.WHATSAPP_TEMPLATE_HAS_BUTTON === 'true';
            if (hasButton) {
                // WhatsApp button URL parameters must be 15 characters or less
                // Must be plain text (domain name only), NOT a full URL
                const maxButtonUrlLength = 15;
                let buttonUrlParam = buttonUrl;
                // Remove protocol if present (https://, http://)
                buttonUrlParam = buttonUrlParam.replace(/^https?:\/\//i, '');
                // Remove www. prefix if present
                buttonUrlParam = buttonUrlParam.replace(/^www\./i, '');
                // Remove trailing slash if present
                buttonUrlParam = buttonUrlParam.replace(/\/$/, '');
                // Extract just the domain (remove path if present)
                try {
                    // If it looks like a URL, extract hostname
                    if (buttonUrlParam.includes('/')) {
                        const urlObj = new URL('https://' + buttonUrlParam);
                        buttonUrlParam = urlObj.hostname.replace('www.', '');
                    }
                }
                catch {
                    // If URL parsing fails, try to extract domain manually
                    const parts = buttonUrlParam.split('/');
                    buttonUrlParam = parts[0].replace('www.', '');
                }
                // Truncate if still too long
                if (buttonUrlParam.length > maxButtonUrlLength) {
                    buttonUrlParam = buttonUrlParam.substring(0, maxButtonUrlLength);
                }
                // Only add button if we have a valid parameter (15 chars or less, plain text)
                if (buttonUrlParam.length > 0 && buttonUrlParam.length <= maxButtonUrlLength) {
                    // Ensure it's plain text (no protocol, no slashes, no special chars)
                    const cleanParam = buttonUrlParam.replace(/[^a-zA-Z0-9.-]/g, '');
                    if (cleanParam.length > 0 && cleanParam.length <= maxButtonUrlLength) {
                        components.push({
                            type: 'button',
                            sub_type: 'url',
                            index: 0,
                            parameters: [
                                {
                                    type: 'text',
                                    text: cleanParam
                                }
                            ]
                        });
                        console.log('✅ Button parameter set:', cleanParam);
                    }
                    else {
                        console.warn('⚠️  Button URL parameter invalid after cleaning, skipping. Original:', buttonUrl);
                    }
                }
                else {
                    console.warn('⚠️  Button URL too long, skipping button parameter. URL:', buttonUrl);
                }
            }
            requestBody = {
                messaging_product: 'whatsapp',
                to: normalizedPhone,
                type: 'template',
                template: {
                    name: templateName,
                    language: {
                        code: templateLanguage
                    },
                    components: components
                }
            };
        }
        else {
            // Use text message (requires 24-hour session)
            const message = `Your NEFÖL verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nDo not share this code with anyone.`;
            requestBody = {
                messaging_product: 'whatsapp',
                to: normalizedPhone,
                type: 'text',
                text: {
                    body: message
                }
            };
        }
        console.log('📤 Sending OTP via:', useTemplate ? 'Template' : 'Text Message');
        if (useTemplate) {
            console.log('   Template Name:', templateName);
            console.log('   Template Language:', templateLanguage);
        }
        const whatsappResponse = await fetch(facebookUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        const whatsappData = await whatsappResponse.json();
        if (!whatsappResponse.ok) {
            console.error('❌ WhatsApp API error:', JSON.stringify(whatsappData, null, 2));
            console.error('   Phone:', normalizedPhone);
            console.error('   Status:', whatsappResponse.status);
            // Still return success to user (don't expose WhatsApp errors)
            // But log the error for debugging
            return (0, apiHelpers_1.sendError)(res, 500, 'Failed to send OTP. Please try again.');
        }
        console.log('✅ OTP sent successfully to:', normalizedPhone);
        console.log('   Message ID:', whatsappData.messages?.[0]?.id || 'N/A');
        (0, apiHelpers_1.sendSuccess)(res, {
            message: 'OTP sent successfully to your WhatsApp',
            expiresIn: 600 // 10 minutes in seconds
        });
    }
    catch (err) {
        console.error('❌ Error sending OTP:', err);
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to send OTP', err);
    }
}
// Verify OTP and create account
async function verifyOTPSignup(pool, req, res) {
    try {
        const { phone, otp, name, email, address } = req.body;
        console.log(`🔍 OTP Signup Verification Request: phone="${phone}", otp="${otp ? otp.substring(0, 2) + '****' : 'missing'}", name="${name}"`);
        const validationError = (0, apiHelpers_1.validateRequired)(req.body, ['phone', 'otp', 'name']);
        if (validationError) {
            return (0, apiHelpers_1.sendError)(res, 400, validationError);
        }
        // Verify OTP using the new OTP service (handles normalization and hashing)
        const otpResult = await (0, otpService_1.verifyOtp)(pool, phone, otp);
        if (!otpResult.ok) {
            console.error(`❌ OTP verification failed for signup: ${otpResult.error?.message}`);
            return (0, apiHelpers_1.sendError)(res, 400, otpResult.error?.message || 'OTP verification failed');
        }
        // Normalize phone number for user lookup (use same normalization as OTP service)
        // Import normalizePhoneNumber to match OTP service behavior
        const { normalizePhoneNumber } = await Promise.resolve().then(() => __importStar(require('../utils/whatsappTemplateHelper')));
        const phoneDigits = phone.replace(/[\s+\-()]/g, '');
        const normalizedPhone = /^\d{10,15}$/.test(phoneDigits)
            ? normalizePhoneNumber(phoneDigits)
            : phoneDigits.toLowerCase().trim();
        // Check if user already exists
        const existingUser = await pool.query('SELECT id FROM users WHERE phone = $1 OR email = $2', [normalizedPhone, email || '']);
        if (existingUser.rows.length > 0) {
            return (0, apiHelpers_1.sendError)(res, 409, 'User already exists');
        }
        // Generate placeholder email if not provided (email is required in users table)
        // Format: phone_918081013175@thenefol.com
        const userEmail = email || `phone_${normalizedPhone}@thenefol.com`;
        // Create new user (no password required for OTP signup)
        const { rows: userRows } = await pool.query(`
      INSERT INTO users (name, email, phone, address, password, is_verified)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING id, name, email, phone, created_at
    `, [name, userEmail, normalizedPhone, address ? JSON.stringify(address) : null, 'otp_signup_' + Date.now()]);
        console.log(`✅ OTP verified and user created: ${normalizedPhone}`);
        const user = userRows[0];
        const token = `user_token_${user.id}_${Date.now()}`;
        console.log('✅ User created via OTP signup:', normalizedPhone);
        // If address is provided, create a default address
        if (address && address.street) {
            try {
                // Ensure user_addresses table exists
                await pool.query(`
          CREATE TABLE IF NOT EXISTS user_addresses (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(255),
            phone VARCHAR(20),
            street TEXT NOT NULL,
            area TEXT,
            landmark TEXT,
            city VARCHAR(100) NOT NULL,
            state VARCHAR(100) NOT NULL,
            zip VARCHAR(20) NOT NULL,
            country VARCHAR(100) DEFAULT 'India',
            address_type VARCHAR(20) DEFAULT 'house',
            address_label VARCHAR(100),
            is_default BOOLEAN DEFAULT false,
            delivery_instructions TEXT,
            weekend_delivery JSONB,
            is_house_type BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
                // Unset any existing defaults
                await pool.query(`
          UPDATE user_addresses SET is_default = false WHERE user_id = $1
        `, [user.id]);
                // Create default address
                await pool.query(`
          INSERT INTO user_addresses (user_id, name, phone, street, city, state, zip, country, address_type, is_default)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
        `, [
                    user.id,
                    name,
                    normalizedPhone,
                    address.street || '',
                    address.city || '',
                    address.state || '',
                    address.zip || '',
                    'India',
                    'house'
                ]);
                console.log('✅ Default address created for OTP signup user:', normalizedPhone);
            }
            catch (addrErr) {
                console.error('⚠️ Error creating default address:', addrErr);
                // Don't fail registration if address creation fails
            }
        }
        // Log registration activity
        await (0, userActivitySchema_1.logUserActivity)(pool, {
            user_id: user.id,
            activity_type: 'auth',
            activity_subtype: 'otp_signup',
            user_agent: req.headers['user-agent'],
            ip_address: req.ip || req.connection.remoteAddress
        });
        (0, apiHelpers_1.sendSuccess)(res, {
            token,
            user
        }, 201);
    }
    catch (err) {
        console.error('❌ Error verifying OTP:', err);
        if (err?.code === '23505') {
            (0, apiHelpers_1.sendError)(res, 409, 'User already exists');
        }
        else {
            (0, apiHelpers_1.sendError)(res, 500, 'Failed to verify OTP', err);
        }
    }
}
// Send OTP via WhatsApp for login
async function sendOTPLogin(pool, req, res) {
    try {
        const { phone } = req.body;
        console.log('📱 Login OTP Request received:', { phone, raw: req.body });
        const validationError = (0, apiHelpers_1.validateRequired)(req.body, ['phone']);
        if (validationError) {
            return (0, apiHelpers_1.sendError)(res, 400, validationError);
        }
        // Normalize phone number (remove spaces, +, etc.)
        const normalizedPhone = phone.replace(/[\s+\-()]/g, '');
        console.log('📱 Normalized phone:', normalizedPhone);
        // Check if user exists
        const { rows: userRows } = await pool.query('SELECT id, name, email, phone FROM users WHERE phone = $1', [normalizedPhone]);
        if (userRows.length === 0) {
            return (0, apiHelpers_1.sendError)(res, 404, 'User not found. Please sign up first.');
        }
        const user = userRows[0];
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
        // Get WhatsApp credentials from environment
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        if (!accessToken || !phoneNumberId) {
            console.error('❌ WhatsApp credentials not configured');
            console.error('   Missing:', !accessToken ? 'WHATSAPP_ACCESS_TOKEN' : '', !phoneNumberId ? 'WHATSAPP_PHONE_NUMBER_ID' : '');
            return (0, apiHelpers_1.sendError)(res, 500, 'WhatsApp service not configured. Please check your environment variables.');
        }
        // Send OTP via WhatsApp
        // Try template first, fallback to text message
        // Use nefol_login_otp template for login (same structure as nefol_verify_code)
        const templateName = process.env.WHATSAPP_LOGIN_OTP_TEMPLATE_NAME || 'nefol_login_otp';
        const templateLanguage = process.env.WHATSAPP_OTP_TEMPLATE_LANGUAGE || 'en';
        const useTemplate = process.env.WHATSAPP_USE_TEMPLATE === 'true';
        const facebookUrl = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;
        let requestBody;
        if (useTemplate) {
            // Use template message (works without 24-hour session)
            // Get contact info from env or use default
            // Note: Template expects phone number format for {{2}} parameter (max 20 chars)
            const contactInfo = process.env.WHATSAPP_CONTACT_INFO || '918887847213';
            // Build parameters array based on template requirements
            const bodyParameters = [
                {
                    type: 'text',
                    text: otp
                }
            ];
            // If template requires contact info (2nd parameter), add it
            // Check if we should send 2 parameters (some templates have {{2}} for contact)
            const sendContactInfo = process.env.WHATSAPP_TEMPLATE_HAS_CONTACT === 'true';
            if (sendContactInfo) {
                // Normalize contact info - remove spaces, +, dashes, etc.
                // Template expects phone number format (digits only, max 20 chars)
                const normalizedContact = contactInfo.replace(/[\s+\-()]/g, '').substring(0, 20);
                bodyParameters.push({
                    type: 'text',
                    text: normalizedContact
                });
            }
            // Build components array
            const components = [
                {
                    type: 'body',
                    parameters: bodyParameters
                }
            ];
            // Check if template has buttons that require parameters
            // URL buttons require a parameter (the URL)
            // IMPORTANT: WhatsApp button URL parameters have a 15-character limit
            // IMPORTANT: Button parameters must be plain text (domain only), NOT full URLs
            const buttonUrl = process.env.WHATSAPP_BUTTON_URL || 'thenefol.com';
            const hasButton = process.env.WHATSAPP_TEMPLATE_HAS_BUTTON === 'true';
            if (hasButton) {
                // WhatsApp button URL parameters must be 15 characters or less
                // Must be plain text (domain name only), NOT a full URL
                const maxButtonUrlLength = 15;
                let buttonUrlParam = buttonUrl;
                // Remove protocol if present (https://, http://)
                buttonUrlParam = buttonUrlParam.replace(/^https?:\/\//i, '');
                // Remove www. prefix if present
                buttonUrlParam = buttonUrlParam.replace(/^www\./i, '');
                // Remove trailing slash if present
                buttonUrlParam = buttonUrlParam.replace(/\/$/, '');
                // Extract just the domain (remove path if present)
                try {
                    // If it looks like a URL, extract hostname
                    if (buttonUrlParam.includes('/')) {
                        const urlObj = new URL('https://' + buttonUrlParam);
                        buttonUrlParam = urlObj.hostname.replace('www.', '');
                    }
                }
                catch {
                    // If URL parsing fails, try to extract domain manually
                    const parts = buttonUrlParam.split('/');
                    buttonUrlParam = parts[0].replace('www.', '');
                }
                // Truncate if still too long
                if (buttonUrlParam.length > maxButtonUrlLength) {
                    buttonUrlParam = buttonUrlParam.substring(0, maxButtonUrlLength);
                }
                // Only add button if we have a valid parameter (15 chars or less, plain text)
                if (buttonUrlParam.length > 0 && buttonUrlParam.length <= maxButtonUrlLength) {
                    // Ensure it's plain text (no protocol, no slashes, no special chars)
                    const cleanParam = buttonUrlParam.replace(/[^a-zA-Z0-9.-]/g, '');
                    if (cleanParam.length > 0 && cleanParam.length <= maxButtonUrlLength) {
                        components.push({
                            type: 'button',
                            sub_type: 'url',
                            index: 0,
                            parameters: [
                                {
                                    type: 'text',
                                    text: cleanParam
                                }
                            ]
                        });
                        console.log('✅ Button parameter set:', cleanParam);
                    }
                    else {
                        console.warn('⚠️  Button URL parameter invalid after cleaning, skipping. Original:', buttonUrl);
                    }
                }
                else {
                    console.warn('⚠️  Button URL too long, skipping button parameter. URL:', buttonUrl);
                }
            }
            requestBody = {
                messaging_product: 'whatsapp',
                to: normalizedPhone,
                type: 'template',
                template: {
                    name: templateName,
                    language: {
                        code: templateLanguage
                    },
                    components: components
                }
            };
        }
        else {
            // Use text message (requires 24-hour session)
            const message = `Your NEFÖL login verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nDo not share this code with anyone.`;
            requestBody = {
                messaging_product: 'whatsapp',
                to: normalizedPhone,
                type: 'text',
                text: {
                    body: message
                }
            };
        }
        console.log('📤 Sending Login OTP via:', useTemplate ? 'Template' : 'Text Message');
        if (useTemplate) {
            console.log('   Template Name:', templateName);
            console.log('   Template Language:', templateLanguage);
        }
        const whatsappResponse = await fetch(facebookUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        const whatsappData = await whatsappResponse.json();
        if (!whatsappResponse.ok) {
            console.error('❌ WhatsApp API error:', JSON.stringify(whatsappData, null, 2));
            console.error('   Phone:', normalizedPhone);
            console.error('   Status:', whatsappResponse.status);
            // Still return success to user (don't expose WhatsApp errors)
            // But log the error for debugging
            return (0, apiHelpers_1.sendError)(res, 500, 'Failed to send OTP. Please try again.');
        }
        console.log('✅ Login OTP sent successfully to:', normalizedPhone);
        console.log('   Message ID:', whatsappData.messages?.[0]?.id || 'N/A');
        (0, apiHelpers_1.sendSuccess)(res, {
            message: 'OTP sent successfully to your WhatsApp',
            expiresIn: 600 // 10 minutes in seconds
        });
    }
    catch (err) {
        console.error('❌ Error sending login OTP:', err);
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to send OTP', err);
    }
}
// Verify OTP and login
async function verifyOTPLogin(pool, req, res) {
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
        // Find user by phone
        const { rows: userRows } = await pool.query('SELECT id, name, email, phone FROM users WHERE phone = $1', [normalizedPhone]);
        if (userRows.length === 0) {
            // Mark OTP as verified
            await pool.query('UPDATE otp_verifications SET verified = true WHERE id = $1', [otpRecord.id]);
            return (0, apiHelpers_1.sendError)(res, 404, 'User not found');
        }
        const user = userRows[0];
        // Mark OTP as verified
        await pool.query('UPDATE otp_verifications SET verified = true WHERE id = $1', [otpRecord.id]);
        // Generate token
        const token = `user_token_${user.id}_${Date.now()}`;
        // Update last login
        await pool.query('UPDATE users SET updated_at = NOW() WHERE id = $1', [user.id]);
        console.log('✅ User logged in via WhatsApp OTP:', normalizedPhone);
        // Log login activity
        await (0, userActivitySchema_1.logUserActivity)(pool, {
            user_id: user.id,
            activity_type: 'auth',
            activity_subtype: 'whatsapp_login',
            user_agent: req.headers['user-agent'],
            ip_address: req.ip || req.connection.remoteAddress
        });
        (0, apiHelpers_1.sendSuccess)(res, {
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone
            }
        });
    }
    catch (err) {
        console.error('❌ Error verifying login OTP:', err);
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to verify OTP', err);
    }
}
// Optimized user profile endpoints
async function getUserProfile(pool, req, res) {
    try {
        const userId = req.userId;
        console.log('🔍 Getting user profile for userId:', userId);
        // Get user data with calculated total_orders from orders table
        const { rows } = await pool.query(`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.phone, 
        u.address, 
        u.profile_photo, 
        COALESCE(u.loyalty_points, 0) as loyalty_points,
        COALESCE(
          (SELECT COUNT(*) FROM orders WHERE customer_email = u.email),
          0
        ) as total_orders,
        COALESCE(u.member_since, u.created_at) as member_since,
        u.is_verified
      FROM users u
      WHERE u.id = $1
    `, [userId]);
        console.log('📊 User profile query result:', rows.length, 'rows');
        if (rows.length === 0) {
            console.log('❌ User not found for ID:', userId);
            return (0, apiHelpers_1.sendError)(res, 404, 'User not found');
        }
        console.log('✅ User profile found:', rows[0].email, 'Orders:', rows[0].total_orders, 'Points:', rows[0].loyalty_points);
        (0, apiHelpers_1.sendSuccess)(res, rows[0]);
    }
    catch (err) {
        console.error('❌ Error fetching user profile:', err);
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to fetch user profile', err);
    }
}
async function updateUserProfile(pool, req, res) {
    try {
        const userId = req.userId;
        const { name, phone, address, profile_photo } = req.body;
        const updates = {};
        if (name !== undefined)
            updates.name = name;
        if (phone !== undefined)
            updates.phone = phone;
        if (address !== undefined)
            updates.address = JSON.stringify(address);
        if (profile_photo !== undefined)
            updates.profile_photo = profile_photo;
        const fields = Object.keys(updates);
        if (fields.length === 0) {
            return (0, apiHelpers_1.sendError)(res, 400, 'No fields to update');
        }
        const setClause = fields.map((field, i) => `${field} = $${i + 2}`).join(', ');
        const values = [userId, ...fields.map(field => updates[field])];
        const { rows } = await pool.query(`
      UPDATE users 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, email, phone, address, profile_photo, 
                loyalty_points, total_orders, member_since, is_verified
    `, values);
        if (rows.length === 0) {
            return (0, apiHelpers_1.sendError)(res, 404, 'User not found');
        }
        (0, apiHelpers_1.sendSuccess)(res, rows[0]);
    }
    catch (err) {
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to update user profile', err);
    }
}
// User Addresses Management
async function getUserAddresses(pool, req, res) {
    try {
        const userId = req.userId;
        // Ensure user_addresses table exists and has required columns
        await pool.query(`
      CREATE TABLE IF NOT EXISTS user_addresses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255),
        phone VARCHAR(20),
        street TEXT NOT NULL,
        area TEXT,
        landmark TEXT,
        city VARCHAR(100) NOT NULL,
        state VARCHAR(100) NOT NULL,
        zip VARCHAR(20) NOT NULL,
        country VARCHAR(100) DEFAULT 'India',
        address_type VARCHAR(20) DEFAULT 'house',
        address_label VARCHAR(100),
        is_default BOOLEAN DEFAULT false,
        delivery_instructions TEXT,
        weekend_delivery JSONB,
        is_house_type BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Migrate existing table: Add missing columns if they don't exist
        // Handle case where table might have old schema (full_name, address_line1, etc.)
        try {
            await pool.query(`
        DO $$
        BEGIN
          -- Add name column if it doesn't exist (migrate from full_name if needed)
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name='user_addresses' AND column_name='name') THEN
            -- Check if full_name exists and migrate data
            IF EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='user_addresses' AND column_name='full_name') THEN
              ALTER TABLE user_addresses ADD COLUMN name VARCHAR(255);
              UPDATE user_addresses SET name = full_name WHERE name IS NULL;
            ELSE
              ALTER TABLE user_addresses ADD COLUMN name VARCHAR(255);
            END IF;
          END IF;
          
          -- Add street column if it doesn't exist (migrate from address_line1 if needed)
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name='user_addresses' AND column_name='street') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='user_addresses' AND column_name='address_line1') THEN
              ALTER TABLE user_addresses ADD COLUMN street TEXT;
              UPDATE user_addresses SET street = address_line1 WHERE street IS NULL;
            ELSE
              ALTER TABLE user_addresses ADD COLUMN street TEXT;
            END IF;
          END IF;
          
          -- Add area column (migrate from address_line2 if needed)
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name='user_addresses' AND column_name='area') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='user_addresses' AND column_name='address_line2') THEN
              ALTER TABLE user_addresses ADD COLUMN area TEXT;
              UPDATE user_addresses SET area = address_line2 WHERE area IS NULL;
            ELSE
              ALTER TABLE user_addresses ADD COLUMN area TEXT;
            END IF;
          END IF;
          
          -- Add zip column (migrate from postal_code if needed)
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name='user_addresses' AND column_name='zip') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='user_addresses' AND column_name='postal_code') THEN
              ALTER TABLE user_addresses ADD COLUMN zip VARCHAR(20);
              UPDATE user_addresses SET zip = postal_code WHERE zip IS NULL;
            ELSE
              ALTER TABLE user_addresses ADD COLUMN zip VARCHAR(20);
            END IF;
          END IF;
          
          -- Add other missing columns
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name='user_addresses' AND column_name='landmark') THEN
            ALTER TABLE user_addresses ADD COLUMN landmark TEXT;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name='user_addresses' AND column_name='address_label') THEN
            ALTER TABLE user_addresses ADD COLUMN address_label VARCHAR(100);
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name='user_addresses' AND column_name='delivery_instructions') THEN
            ALTER TABLE user_addresses ADD COLUMN delivery_instructions TEXT;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name='user_addresses' AND column_name='weekend_delivery') THEN
            ALTER TABLE user_addresses ADD COLUMN weekend_delivery JSONB;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                         WHERE table_name='user_addresses' AND column_name='is_house_type') THEN
            ALTER TABLE user_addresses ADD COLUMN is_house_type BOOLEAN DEFAULT false;
          END IF;
          
          -- Try to make old columns nullable if they exist (to avoid NOT NULL constraint violations)
          -- Note: The INSERT statement below will populate these columns, so this is mainly for safety
          IF EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name='user_addresses' AND column_name='address_line1') THEN
            BEGIN
              ALTER TABLE user_addresses ALTER COLUMN address_line1 DROP NOT NULL;
            EXCEPTION WHEN OTHERS THEN
              -- Column might already be nullable or this might fail - that's okay
              NULL;
            END;
          END IF;
          
          IF EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name='user_addresses' AND column_name='postal_code') THEN
            BEGIN
              ALTER TABLE user_addresses ALTER COLUMN postal_code DROP NOT NULL;
            EXCEPTION WHEN OTHERS THEN
              -- Column might already be nullable or this might fail - that's okay
              NULL;
            END;
          END IF;
        END $$;
      `);
        }
        catch (migrationError) {
            console.error('Migration error (may be expected if columns already exist):', migrationError);
        }
        await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id)
    `);
        const { rows } = await pool.query(`
      SELECT * FROM user_addresses 
      WHERE user_id = $1 
      ORDER BY is_default DESC, created_at DESC
    `, [userId]);
        (0, apiHelpers_1.sendSuccess)(res, rows);
    }
    catch (err) {
        console.error('Error fetching user addresses:', err);
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to fetch addresses', err);
    }
}
async function createUserAddress(pool, req, res) {
    try {
        const userId = req.userId;
        const { name, phone, street, area, landmark, city, state, zip, country, address_type, address_label, is_default, delivery_instructions, weekend_delivery, is_house_type } = req.body;
        // Check address limit (max 5)
        const countResult = await pool.query(`
      SELECT COUNT(*) as count FROM user_addresses WHERE user_id = $1
    `, [userId]);
        if (parseInt(countResult.rows[0].count) >= 5) {
            return (0, apiHelpers_1.sendError)(res, 400, 'Maximum 5 addresses allowed');
        }
        // If setting as default, unset other defaults
        if (is_default) {
            await pool.query(`
        UPDATE user_addresses SET is_default = false WHERE user_id = $1
      `, [userId]);
        }
        // Check if old columns exist (for backward compatibility)
        const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_addresses' 
      AND column_name IN ('address_line1', 'address_line2', 'full_name', 'postal_code')
    `);
        const hasAddressLine1 = columnCheck.rows.some(r => r.column_name === 'address_line1');
        const hasAddressLine2 = columnCheck.rows.some(r => r.column_name === 'address_line2');
        const hasFullName = columnCheck.rows.some(r => r.column_name === 'full_name');
        const hasPostalCode = columnCheck.rows.some(r => r.column_name === 'postal_code');
        // Build INSERT statement with both old and new columns if old columns exist
        let insertColumns = 'user_id, name, phone, street, area, landmark, city, state, zip, country, address_type, address_label, is_default, delivery_instructions, weekend_delivery, is_house_type';
        let insertValues = '$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16';
        let paramIndex = 17;
        const insertParams = [
            userId, name, phone, street, area, landmark, city, state, zip, country || 'India',
            address_type || 'house', address_label, is_default || false, delivery_instructions,
            JSON.stringify(weekend_delivery || {}), is_house_type || false
        ];
        // Add old columns if they exist
        if (hasFullName) {
            insertColumns += ', full_name';
            insertValues += `, $${paramIndex++}`;
            insertParams.push(name || '');
        }
        if (hasAddressLine1) {
            insertColumns += ', address_line1';
            insertValues += `, $${paramIndex++}`;
            insertParams.push(street || '');
        }
        if (hasAddressLine2) {
            insertColumns += ', address_line2';
            insertValues += `, $${paramIndex++}`;
            insertParams.push(area || null);
        }
        if (hasPostalCode) {
            insertColumns += ', postal_code';
            insertValues += `, $${paramIndex++}`;
            insertParams.push(zip || '');
        }
        const { rows } = await pool.query(`
      INSERT INTO user_addresses (${insertColumns})
      VALUES (${insertValues})
      RETURNING *
    `, insertParams);
        (0, apiHelpers_1.sendSuccess)(res, rows[0]);
    }
    catch (err) {
        console.error('Error creating address:', err);
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to create address', err);
    }
}
async function updateUserAddress(pool, req, res) {
    try {
        const userId = req.userId;
        const addressId = parseInt(req.params.id);
        const { name, phone, street, area, landmark, city, state, zip, country, address_type, address_label, is_default, delivery_instructions, weekend_delivery, is_house_type } = req.body;
        // Verify address belongs to user
        const checkResult = await pool.query(`
      SELECT id FROM user_addresses WHERE id = $1 AND user_id = $2
    `, [addressId, userId]);
        if (checkResult.rows.length === 0) {
            return (0, apiHelpers_1.sendError)(res, 404, 'Address not found');
        }
        // If setting as default, unset other defaults
        if (is_default) {
            await pool.query(`
        UPDATE user_addresses SET is_default = false WHERE user_id = $1 AND id != $2
      `, [userId, addressId]);
        }
        const updateFields = [];
        const values = [addressId, userId];
        let paramIndex = 3;
        if (name !== undefined) {
            updateFields.push(`name = $${paramIndex++}`);
            values.push(name);
        }
        if (phone !== undefined) {
            updateFields.push(`phone = $${paramIndex++}`);
            values.push(phone);
        }
        if (street !== undefined) {
            updateFields.push(`street = $${paramIndex++}`);
            values.push(street);
        }
        if (area !== undefined) {
            updateFields.push(`area = $${paramIndex++}`);
            values.push(area);
        }
        if (landmark !== undefined) {
            updateFields.push(`landmark = $${paramIndex++}`);
            values.push(landmark);
        }
        if (city !== undefined) {
            updateFields.push(`city = $${paramIndex++}`);
            values.push(city);
        }
        if (state !== undefined) {
            updateFields.push(`state = $${paramIndex++}`);
            values.push(state);
        }
        if (zip !== undefined) {
            updateFields.push(`zip = $${paramIndex++}`);
            values.push(zip);
        }
        if (country !== undefined) {
            updateFields.push(`country = $${paramIndex++}`);
            values.push(country);
        }
        if (address_type !== undefined) {
            updateFields.push(`address_type = $${paramIndex++}`);
            values.push(address_type);
        }
        if (address_label !== undefined) {
            updateFields.push(`address_label = $${paramIndex++}`);
            values.push(address_label);
        }
        if (is_default !== undefined) {
            updateFields.push(`is_default = $${paramIndex++}`);
            values.push(is_default);
        }
        if (delivery_instructions !== undefined) {
            updateFields.push(`delivery_instructions = $${paramIndex++}`);
            values.push(delivery_instructions);
        }
        if (weekend_delivery !== undefined) {
            updateFields.push(`weekend_delivery = $${paramIndex++}`);
            values.push(JSON.stringify(weekend_delivery));
        }
        if (is_house_type !== undefined) {
            updateFields.push(`is_house_type = $${paramIndex++}`);
            values.push(is_house_type);
        }
        if (updateFields.length === 0) {
            return (0, apiHelpers_1.sendError)(res, 400, 'No fields to update');
        }
        updateFields.push('updated_at = NOW()');
        const { rows } = await pool.query(`
      UPDATE user_addresses SET ${updateFields.join(', ')}
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, values);
        (0, apiHelpers_1.sendSuccess)(res, rows[0]);
    }
    catch (err) {
        console.error('Error updating address:', err);
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to update address', err);
    }
}
async function deleteUserAddress(pool, req, res) {
    try {
        const userId = req.userId;
        const addressId = parseInt(req.params.id);
        const { rowCount } = await pool.query(`
      DELETE FROM user_addresses WHERE id = $1 AND user_id = $2
    `, [addressId, userId]);
        if (rowCount === 0) {
            return (0, apiHelpers_1.sendError)(res, 404, 'Address not found');
        }
        (0, apiHelpers_1.sendSuccess)(res, { message: 'Address deleted successfully' });
    }
    catch (err) {
        console.error('Error deleting address:', err);
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to delete address', err);
    }
}
async function setDefaultAddress(pool, req, res) {
    try {
        const userId = req.userId;
        const addressId = parseInt(req.params.id);
        // Verify address belongs to user
        const checkResult = await pool.query(`
      SELECT id FROM user_addresses WHERE id = $1 AND user_id = $2
    `, [addressId, userId]);
        if (checkResult.rows.length === 0) {
            return (0, apiHelpers_1.sendError)(res, 404, 'Address not found');
        }
        // Unset all other defaults
        await pool.query(`
      UPDATE user_addresses SET is_default = false WHERE user_id = $1
    `, [userId]);
        // Set this as default
        const { rows } = await pool.query(`
      UPDATE user_addresses SET is_default = true, updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [addressId, userId]);
        (0, apiHelpers_1.sendSuccess)(res, rows[0]);
    }
    catch (err) {
        console.error('Error setting default address:', err);
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to set default address', err);
    }
}

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startCartAbandonmentCron = startCartAbandonmentCron;
// Cart Abandonment Cron Job - Runs every hour
const node_cron_1 = __importDefault(require("node-cron"));
const emailService_1 = require("../services/emailService");
function startCartAbandonmentCron(pool) {
    // Run every hour at minute 0 (e.g., 1:00, 2:00, 3:00, etc.)
    node_cron_1.default.schedule('0 * * * *', async () => {
        try {
            console.log('🛒 Running cart abandonment check...');
            // Get carts that are older than 1 hour and haven't been checked out
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            // Query to find abandoned carts
            // We'll check carts that were last updated more than 1 hour ago
            // and the user hasn't placed an order since then
            const abandonedCarts = await pool.query(`
        SELECT DISTINCT
          c.user_id,
          u.email,
          u.name,
          c.updated_at as cart_updated_at
        FROM cart c
        INNER JOIN users u ON c.user_id = u.id
        WHERE c.updated_at < $1
          AND u.email IS NOT NULL
          AND NOT EXISTS (
            -- Check if user has placed an order in the last hour
            SELECT 1 
            FROM orders o 
            WHERE o.customer_email = u.email 
              AND o.created_at > c.updated_at
          )
        GROUP BY c.user_id, u.email, u.name, c.updated_at
      `, [oneHourAgo]);
            console.log(`📧 Found ${abandonedCarts.rows.length} abandoned carts`);
            for (const cart of abandonedCarts.rows) {
                try {
                    // Get cart items for this user
                    const cartItems = await pool.query(`
            SELECT 
              c.*,
              p.title,
              p.price,
              p.slug,
              jsonb_build_object(
                'id', p.id,
                'title', p.title,
                'price', p.price,
                'slug', p.slug
              ) as product
            FROM cart c
            INNER JOIN products p ON c.product_id = p.id
            WHERE c.user_id = $1
          `, [cart.user_id]);
                    if (cartItems.rows.length > 0) {
                        // Check if we've already sent an abandonment email for this cart
                        // (to avoid spamming users)
                        const emailSent = await pool.query(`
              SELECT 1 FROM cart_abandonment_emails
              WHERE user_id = $1 
                AND cart_updated_at = $2
                AND sent_at > NOW() - INTERVAL '24 hours'
            `, [cart.user_id, cart.cart_updated_at]);
                        if (emailSent.rows.length === 0) {
                            // Send abandonment email
                            await (0, emailService_1.sendCartAbandonmentEmail)(cart.email, cart.name || 'Customer', cartItems.rows);
                            // Record that we sent the email
                            await pool.query(`
                CREATE TABLE IF NOT EXISTS cart_abandonment_emails (
                  id SERIAL PRIMARY KEY,
                  user_id INTEGER NOT NULL,
                  cart_updated_at TIMESTAMP NOT NULL,
                  sent_at TIMESTAMP DEFAULT NOW()
                )
              `);
                            await pool.query(`
                INSERT INTO cart_abandonment_emails (user_id, cart_updated_at)
                VALUES ($1, $2)
              `, [cart.user_id, cart.cart_updated_at]);
                            console.log(`✅ Cart abandonment email sent to user ${cart.user_id} (${cart.email})`);
                        }
                        else {
                            console.log(`⏭️  Skipping user ${cart.user_id} - email already sent in last 24 hours`);
                        }
                    }
                }
                catch (userError) {
                    console.error(`❌ Error processing cart for user ${cart.user_id}:`, userError);
                    // Continue with next user
                }
            }
            console.log('✅ Cart abandonment check completed');
        }
        catch (error) {
            console.error('❌ Error in cart abandonment cron job:', error);
        }
    });
    console.log('✅ Cart abandonment cron job started (runs every hour)');
}

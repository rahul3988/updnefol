"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWelcomeEmail = sendWelcomeEmail;
exports.sendCartAddedEmail = sendCartAddedEmail;
exports.sendOrderConfirmationEmail = sendOrderConfirmationEmail;
exports.sendPaymentFailedEmail = sendPaymentFailedEmail;
exports.sendOrderStatusUpdateEmail = sendOrderStatusUpdateEmail;
exports.sendCartAbandonmentEmail = sendCartAbandonmentEmail;
// Email Service - All 6 Email Automation Events
const email_1 = require("../utils/email");
// 1. Welcome Email - User Signup
async function sendWelcomeEmail(userEmail, userName) {
    try {
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Thenefol</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #fff; margin: 0;">Welcome to Thenefol!</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-bottom: 20px;">Hi ${userName},</p>
          <p style="font-size: 16px; margin-bottom: 20px;">Your account is ready! We're thrilled to have you join the Thenefol family.</p>
          <p style="font-size: 16px; margin-bottom: 20px;">Start exploring our premium skincare and beauty products crafted with care.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://thenefol.com" style="background: #667eea; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Start Shopping</a>
          </div>
          <p style="font-size: 14px; color: #666; margin-top: 30px;">Thank you for choosing Thenefol!</p>
        </div>
      </body>
      </html>
    `;
        await email_1.transporter.sendMail({
            from: `"Thenefol" <${(0, email_1.getAdminEmail)()}>`,
            to: userEmail,
            subject: 'Welcome to Thenefol — your account is ready.',
            html
        });
        console.log(`✅ Welcome email sent to: ${userEmail}`);
    }
    catch (error) {
        console.error('❌ Error sending welcome email:', error);
        // Don't throw - email failures shouldn't break user signup
    }
}
// 2. Cart Reminder - Item Added to Cart
async function sendCartAddedEmail(userEmail, userName, productName, productPrice) {
    try {
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Item Added to Cart</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #667eea; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h2 style="color: #fff; margin: 0;">Item Added to Your Cart</h2>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-bottom: 20px;">Hi ${userName},</p>
          <p style="font-size: 16px; margin-bottom: 20px;">Great choice! We've added <strong>${productName}</strong> to your cart.</p>
          <div style="background: #fff; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea;">
            <p style="margin: 0; font-size: 18px; font-weight: bold;">${productName}</p>
            <p style="margin: 10px 0 0 0; font-size: 16px; color: #667eea;">₹${productPrice.toFixed(2)}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://thenefol.com/#/user/checkout" style="background: #667eea; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Complete Your Checkout</a>
          </div>
          <p style="font-size: 14px; color: #666; margin-top: 30px;">Don't wait too long - complete your purchase to secure your items!</p>
        </div>
      </body>
      </html>
    `;
        await email_1.transporter.sendMail({
            from: `"Thenefol" <${(0, email_1.getAdminEmail)()}>`,
            to: userEmail,
            subject: `${productName} added to your cart`,
            html
        });
        console.log(`✅ Cart reminder email sent to: ${userEmail} for product: ${productName}`);
    }
    catch (error) {
        console.error('❌ Error sending cart reminder email:', error);
        // Don't throw - email failures shouldn't break cart operations
    }
}
// 3. Order Confirmation - Order Placed
async function sendOrderConfirmationEmail(order, sendToAdmin = false) {
    try {
        const itemsHtml = order.items?.map((item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.title || item.name || 'Product'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity || 1}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</td>
      </tr>
    `).join('') || '';
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Confirmation</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #667eea; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #fff; margin: 0;">Order Confirmed!</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-bottom: 20px;">Hi ${order.customer_name},</p>
          <p style="font-size: 16px; margin-bottom: 20px;">Thank you for your order! We've received your order and will process it shortly.</p>
          
          <div style="background: #fff; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #667eea;">Order Details</h3>
            <p><strong>Order Number:</strong> ${order.order_number}</p>
            <p><strong>Payment Status:</strong> ${order.payment_status || 'Pending'}</p>
            <p><strong>Payment Method:</strong> ${order.payment_method || 'N/A'}</p>
          </div>

          <div style="background: #fff; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #667eea;">Order Items</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f5f5f5;">
                  <th style="padding: 10px; text-align: left; border-bottom: 2px solid #667eea;">Item</th>
                  <th style="padding: 10px; text-align: center; border-bottom: 2px solid #667eea;">Qty</th>
                  <th style="padding: 10px; text-align: right; border-bottom: 2px solid #667eea;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          </div>

          <div style="background: #fff; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <table style="width: 100%;">
              <tr>
                <td style="padding: 5px 0;"><strong>Subtotal:</strong></td>
                <td style="text-align: right; padding: 5px 0;">₹${(order.subtotal || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0;"><strong>Shipping:</strong></td>
                <td style="text-align: right; padding: 5px 0;">₹${(order.shipping || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0;"><strong>Tax:</strong></td>
                <td style="text-align: right; padding: 5px 0;">₹${(order.tax || 0).toFixed(2)}</td>
              </tr>
              ${order.discount_amount > 0 ? `
              <tr>
                <td style="padding: 5px 0;"><strong>Discount:</strong></td>
                <td style="text-align: right; padding: 5px 0; color: #28a745;">-₹${(order.discount_amount || 0).toFixed(2)}</td>
              </tr>
              ` : ''}
              <tr style="border-top: 2px solid #667eea;">
                <td style="padding: 10px 0;"><strong>Total:</strong></td>
                <td style="text-align: right; padding: 10px 0; font-size: 18px; font-weight: bold; color: #667eea;">₹${(order.total || 0).toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 14px; color: #666; margin-top: 30px;">We'll send you another email once your order ships. Thank you for shopping with Thenefol!</p>
        </div>
      </body>
      </html>
    `;
        const recipient = sendToAdmin ? (0, email_1.getAdminEmail)() : order.customer_email;
        const subject = sendToAdmin
            ? `[Admin] New Order: ${order.order_number}`
            : `Order Confirmation - ${order.order_number}`;
        await email_1.transporter.sendMail({
            from: `"Thenefol" <${(0, email_1.getAdminEmail)()}>`,
            to: recipient,
            subject,
            html
        });
        console.log(`✅ Order confirmation email sent to: ${recipient} for order: ${order.order_number}`);
    }
    catch (error) {
        console.error('❌ Error sending order confirmation email:', error);
        // Don't throw - email failures shouldn't break order creation
    }
}
// 4. Payment Failed Email
async function sendPaymentFailedEmail(userEmail, userName, orderNumber, errorMessage) {
    try {
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Failed</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #dc3545; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #fff; margin: 0;">Payment Failed</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-bottom: 20px;">Hi ${userName},</p>
          <p style="font-size: 16px; margin-bottom: 20px;">We encountered an issue processing your payment for order <strong>${orderNumber}</strong>.</p>
          ${errorMessage ? `<p style="font-size: 14px; color: #dc3545; background: #fff; padding: 15px; border-radius: 5px; margin: 20px 0;">${errorMessage}</p>` : ''}
          <p style="font-size: 16px; margin-bottom: 20px;">Don't worry - your order is still saved. Please try again or use a different payment method.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://thenefol.com/#/user/checkout" style="background: #667eea; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Retry Payment</a>
          </div>
          <p style="font-size: 14px; color: #666; margin-top: 30px;">If you continue to experience issues, please contact our support team at ${(0, email_1.getAdminEmail)()}</p>
        </div>
      </body>
      </html>
    `;
        await email_1.transporter.sendMail({
            from: `"Thenefol" <${(0, email_1.getAdminEmail)()}>`,
            to: userEmail,
            subject: `Payment Failed - Order ${orderNumber}`,
            html
        });
        console.log(`✅ Payment failed email sent to: ${userEmail} for order: ${orderNumber}`);
    }
    catch (error) {
        console.error('❌ Error sending payment failed email:', error);
        // Don't throw - email failures shouldn't break payment flow
    }
}
// 5. Order Status Update Email
async function sendOrderStatusUpdateEmail(order) {
    try {
        const statusMessages = {
            'shipped': {
                title: 'Your Order Has Shipped!',
                message: 'Great news! Your order has been shipped and is on its way to you.',
                color: '#28a745'
            },
            'out_for_delivery': {
                title: 'Out for Delivery',
                message: 'Your order is out for delivery and should arrive soon!',
                color: '#17a2b8'
            },
            'delivered': {
                title: 'Order Delivered!',
                message: 'Your order has been delivered. We hope you love your purchase!',
                color: '#667eea'
            }
        };
        const statusInfo = statusMessages[order.status?.toLowerCase()] || {
            title: 'Order Status Updated',
            message: `Your order status has been updated to: ${order.status}`,
            color: '#667eea'
        };
        const trackingHtml = order.tracking ? `
      <div style="background: #fff; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid ${statusInfo.color};">
        <p style="margin: 0; font-size: 16px;"><strong>Tracking Number:</strong> ${order.tracking}</p>
        ${order.tracking_url ? `<p style="margin: 10px 0 0 0;"><a href="${order.tracking_url}" style="color: ${statusInfo.color}; text-decoration: none;">Track Your Order →</a></p>` : ''}
      </div>
    ` : '';
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Status Update</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: ${statusInfo.color}; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #fff; margin: 0;">${statusInfo.title}</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-bottom: 20px;">Hi ${order.customer_name},</p>
          <p style="font-size: 16px; margin-bottom: 20px;">${statusInfo.message}</p>
          
          <div style="background: #fff; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Order Number:</strong> ${order.order_number}</p>
            <p style="margin: 10px 0 0 0;"><strong>Status:</strong> <span style="color: ${statusInfo.color}; font-weight: bold;">${order.status}</span></p>
          </div>

          ${trackingHtml}

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://thenefol.com/#/user/orders" style="background: ${statusInfo.color}; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Order Details</a>
          </div>

          <p style="font-size: 14px; color: #666; margin-top: 30px;">Thank you for shopping with Thenefol!</p>
        </div>
      </body>
      </html>
    `;
        await email_1.transporter.sendMail({
            from: `"Thenefol" <${(0, email_1.getAdminEmail)()}>`,
            to: order.customer_email,
            subject: `${statusInfo.title} - Order ${order.order_number}`,
            html
        });
        console.log(`✅ Order status update email sent to: ${order.customer_email} for order: ${order.order_number} (Status: ${order.status})`);
    }
    catch (error) {
        console.error('❌ Error sending order status update email:', error);
        // Don't throw - email failures shouldn't break status updates
    }
}
// 6. Cart Abandonment Email
async function sendCartAbandonmentEmail(userEmail, userName, cartItems) {
    try {
        const itemsHtml = cartItems.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.product?.title || item.title || 'Product'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity || 1}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${((item.product?.price || item.price || 0) * (item.quantity || 1)).toFixed(2)}</td>
      </tr>
    `).join('');
        const totalAmount = cartItems.reduce((sum, item) => {
            return sum + ((item.product?.price || item.price || 0) * (item.quantity || 1));
        }, 0);
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Complete Your Purchase</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #ffc107; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: #333; margin: 0;">Don't Miss Out!</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; margin-bottom: 20px;">Hi ${userName},</p>
          <p style="font-size: 16px; margin-bottom: 20px;">You left some amazing products in your cart! Complete your purchase now before they're gone.</p>
          
          <div style="background: #fff; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #667eea;">Items in Your Cart</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f5f5f5;">
                  <th style="padding: 10px; text-align: left; border-bottom: 2px solid #667eea;">Item</th>
                  <th style="padding: 10px; text-align: center; border-bottom: 2px solid #667eea;">Qty</th>
                  <th style="padding: 10px; text-align: right; border-bottom: 2px solid #667eea;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
              <tfoot>
                <tr style="border-top: 2px solid #667eea;">
                  <td colspan="2" style="padding: 10px 0; font-weight: bold;">Total:</td>
                  <td style="text-align: right; padding: 10px 0; font-size: 18px; font-weight: bold; color: #667eea;">₹${totalAmount.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://thenefol.com/#/user/checkout" style="background: #667eea; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Complete Your Purchase</a>
          </div>

          <p style="font-size: 14px; color: #666; margin-top: 30px;">Hurry! Complete your checkout to secure these items before they're gone.</p>
        </div>
      </body>
      </html>
    `;
        await email_1.transporter.sendMail({
            from: `"Thenefol" <${(0, email_1.getAdminEmail)()}>`,
            to: userEmail,
            subject: 'Complete Your Purchase - Items Waiting in Your Cart',
            html
        });
        console.log(`✅ Cart abandonment email sent to: ${userEmail}`);
    }
    catch (error) {
        console.error('❌ Error sending cart abandonment email:', error);
        // Don't throw - email failures shouldn't break cron job
    }
}

"use strict";
// Utility functions for invoice generation
Object.defineProperty(exports, "__esModule", { value: true });
exports.DISTRICT_CODES = exports.STATE_CODES = void 0;
exports.getStateCode = getStateCode;
exports.numberToWords = numberToWords;
exports.generateInvoiceNumber = generateInvoiceNumber;
exports.getDistrictCode = getDistrictCode;
exports.isComboOrder = isComboOrder;
exports.generateOrderNumber = generateOrderNumber;
exports.generateNewInvoiceNumber = generateNewInvoiceNumber;
exports.getNextInvoiceSequenceNumber = getNextInvoiceSequenceNumber;
exports.getOrGenerateInvoiceNumber = getOrGenerateInvoiceNumber;
// State code mapping (Indian states)
exports.STATE_CODES = {
    'Andhra Pradesh': '37',
    'Arunachal Pradesh': '12',
    'Assam': '18',
    'Bihar': '10',
    'Chhattisgarh': '22',
    'Goa': '30',
    'Gujarat': '24',
    'Haryana': '06',
    'Himachal Pradesh': '02',
    'Jharkhand': '20',
    'Karnataka': '29',
    'Kerala': '32',
    'Madhya Pradesh': '23',
    'Maharashtra': '27',
    'Manipur': '14',
    'Meghalaya': '17',
    'Mizoram': '15',
    'Nagaland': '13',
    'Odisha': '21',
    'Punjab': '03',
    'Rajasthan': '08',
    'Sikkim': '11',
    'Tamil Nadu': '33',
    'Telangana': '36',
    'Tripura': '16',
    'Uttar Pradesh': '09',
    'Uttarakhand': '05',
    'West Bengal': '19',
    'Andaman and Nicobar Islands': '35',
    'Chandigarh': '04',
    'Dadra and Nagar Haveli and Daman and Diu': '26',
    'Delhi': '07',
    'Jammu and Kashmir': '01',
    'Ladakh': '38',
    'Lakshadweep': '31',
    'Puducherry': '34'
};
// Get state code from state name
function getStateCode(stateName) {
    if (!stateName)
        return '';
    const normalized = stateName.trim();
    return exports.STATE_CODES[normalized] || '';
}
// Convert number to words (Indian numbering system)
function numberToWords(amount) {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
        'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    function convertHundreds(num) {
        let result = '';
        if (num >= 100) {
            result += ones[Math.floor(num / 100)] + ' Hundred ';
            num %= 100;
        }
        if (num >= 20) {
            result += tens[Math.floor(num / 10)] + ' ';
            num %= 10;
        }
        if (num > 0) {
            result += ones[num] + ' ';
        }
        return result.trim();
    }
    if (amount === 0)
        return 'Zero';
    const crore = Math.floor(amount / 10000000);
    const lakh = Math.floor((amount % 10000000) / 100000);
    const thousand = Math.floor((amount % 100000) / 1000);
    const hundred = Math.floor((amount % 1000) / 100);
    const remainder = amount % 100;
    let words = '';
    if (crore > 0) {
        words += convertHundreds(crore) + ' Crore ';
    }
    if (lakh > 0) {
        words += convertHundreds(lakh) + ' Lakh ';
    }
    if (thousand > 0) {
        words += convertHundreds(thousand) + ' Thousand ';
    }
    if (hundred > 0) {
        words += convertHundreds(hundred) + ' Hundred ';
    }
    if (remainder > 0) {
        words += convertHundreds(remainder);
    }
    return words.trim() + ' only';
}
// Generate invoice number
async function generateInvoiceNumber(pool, orderId) {
    const currentYear = new Date().getFullYear();
    const financialYear = `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
    // Get the last invoice number for this financial year
    const result = await pool.query(`SELECT invoice_number FROM invoice_numbers 
     WHERE financial_year = $1 
     ORDER BY id DESC LIMIT 1`, [financialYear]);
    let sequence = 1;
    if (result.rows.length > 0) {
        const lastInvoice = result.rows[0].invoice_number;
        // Extract sequence number (format: IN-XXX or similar)
        const match = lastInvoice.match(/-(\d+)$/);
        if (match) {
            sequence = parseInt(match[1]) + 1;
        }
    }
    const invoiceNumber = `IN-${sequence.toString().padStart(3, '0')}`;
    // Store invoice number
    await pool.query(`INSERT INTO invoice_numbers (invoice_number, order_id, financial_year)
     VALUES ($1, $2, $3)`, [invoiceNumber, orderId, financialYear]);
    return invoiceNumber;
}
// District code mapping (for invoice numbers)
exports.DISTRICT_CODES = {
    'lucknow': 'LKO',
    'delhi': 'DEL',
    'mumbai': 'BOM',
    'bangalore': 'BLR',
    'hyderabad': 'HYD',
    'chennai': 'MAA',
    'kolkata': 'CCU',
    'pune': 'PNQ',
    'ahmedabad': 'AMD',
    'jaipur': 'JAI'
    // Add more district codes as needed
};
// Get district code from city name
function getDistrictCode(cityName) {
    if (!cityName)
        return 'LKO'; // Default to Lucknow
    const normalized = cityName.toLowerCase().trim();
    return exports.DISTRICT_CODES[normalized] || 'LKO'; // Default to Lucknow if not found
}
// Check if order contains combo products
function isComboOrder(items) {
    if (!items || items.length === 0)
        return false;
    return items.some((item) => {
        const category = (item.category || item.details?.category || '').toLowerCase();
        const slug = (item.slug || '').toLowerCase();
        const title = (item.title || item.name || '').toLowerCase();
        return category.includes('combo') ||
            category.includes('combo pack') ||
            slug.includes('combo') ||
            title.includes('combo');
    });
}
// Generate new format order number
// Format: NS-093011251001 (Single) or NC-093011251001 (Combo)
// NS/NC + GST Code (09) + Date (DDMMYY) + Invoice Number (4 digits)
async function generateOrderNumber(pool, items) {
    const isCombo = isComboOrder(items);
    const prefix = isCombo ? 'NC' : 'NS';
    const gstCode = '09';
    // Get current date in DDMMYY format
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear().toString().slice(-2);
    const dateStr = `${day}${month}${year}`;
    // Get next invoice number (starting from 1001)
    const invoiceNum = await getNextInvoiceSequenceNumber(pool);
    // Format: NS-093011251001
    return `${prefix}-${gstCode}${dateStr}${invoiceNum}`;
}
// Generate new format invoice number
// Format: N09LKO3011251001
// N + GST Code (09) + District Code (LKO) + Date (DDMMYY) + Invoice Number (4 digits)
async function generateNewInvoiceNumber(pool, shippingAddress) {
    const prefix = 'N';
    const gstCode = '09';
    // Get district code from shipping address
    const city = shippingAddress?.city || shippingAddress?.district || 'Lucknow';
    const districtCode = getDistrictCode(city);
    // Get current date in DDMMYY format
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear().toString().slice(-2);
    const dateStr = `${day}${month}${year}`;
    // Get next invoice number (starting from 1001)
    const invoiceNum = await getNextInvoiceSequenceNumber(pool);
    // Format: N09LKO3011251001
    return `${prefix}${gstCode}${districtCode}${dateStr}${invoiceNum}`;
}
// Get next invoice sequence number (starting from 1001)
async function getNextInvoiceSequenceNumber(pool) {
    try {
        // Check if invoice_sequence table exists, create if not
        await pool.query(`
      CREATE TABLE IF NOT EXISTS invoice_sequence (
        id SERIAL PRIMARY KEY,
        current_number INTEGER NOT NULL DEFAULT 1000,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Initialize if empty
        const checkResult = await pool.query('SELECT current_number FROM invoice_sequence LIMIT 1');
        if (checkResult.rows.length === 0) {
            await pool.query('INSERT INTO invoice_sequence (current_number) VALUES (1000)');
        }
        // Get and increment the sequence number
        const result = await pool.query(`
      UPDATE invoice_sequence 
      SET current_number = current_number + 1, updated_at = CURRENT_TIMESTAMP
      RETURNING current_number
    `);
        const nextNumber = result.rows[0].current_number;
        return nextNumber.toString().padStart(4, '0'); // Ensure 4 digits (1001, 1002, etc.)
    }
    catch (err) {
        console.error('Error getting invoice sequence number:', err);
        // Fallback: use timestamp-based number if table fails
        return Date.now().toString().slice(-4);
    }
}
// Get or generate invoice number for an order
async function getOrGenerateInvoiceNumber(pool, order) {
    // Ensure invoice_number column exists
    try {
        await pool.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'invoice_number') THEN
          ALTER TABLE orders ADD COLUMN invoice_number text;
        END IF;
      END $$;
    `);
    }
    catch (err) {
        // Column might already exist, ignore error
        console.log('Invoice number column check:', err);
    }
    if (order.invoice_number) {
        return order.invoice_number;
    }
    const invoiceNumber = await generateInvoiceNumber(pool, order.id);
    // Update order with invoice number
    try {
        await pool.query(`UPDATE orders SET invoice_number = $1 WHERE id = $2`, [invoiceNumber, order.id]);
    }
    catch (err) {
        // If column doesn't exist, add it first
        if (err.code === '42703') {
            await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number text`);
            await pool.query(`UPDATE orders SET invoice_number = $1 WHERE id = $2`, [invoiceNumber, order.id]);
        }
        else {
            throw err;
        }
    }
    return invoiceNumber;
}

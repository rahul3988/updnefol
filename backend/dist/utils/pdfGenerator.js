"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInvoicePDF = generateInvoicePDF;
// PDF Generation Utility using Puppeteer
const puppeteer_1 = __importDefault(require("puppeteer"));
const amazonInvoiceTemplate_1 = require("./amazonInvoiceTemplate");
/**
 * Generate PDF invoice from order data
 */
async function generateInvoicePDF(pool, order, baseUrl = 'https://thenefol.com') {
    let browser;
    try {
        // Fetch invoice settings from database
        const companyDetailsResult = await pool.query(`SELECT setting_value FROM store_settings WHERE setting_key = 'invoice_company_details'`);
        const taxResult = await pool.query(`SELECT setting_value FROM store_settings WHERE setting_key = 'invoice_tax'`);
        const termsResult = await pool.query(`SELECT setting_value FROM store_settings WHERE setting_key = 'invoice_terms'`);
        const signatureResult = await pool.query(`SELECT setting_value FROM store_settings WHERE setting_key = 'invoice_signature'`);
        const currencyResult = await pool.query(`SELECT setting_value FROM store_settings WHERE setting_key = 'invoice_currency'`);
        const logoResult = await pool.query(`SELECT setting_value FROM store_settings WHERE setting_key = 'invoice_logo_url'`);
        const signatoryPhotoResult = await pool.query(`SELECT setting_value FROM store_settings WHERE setting_key = 'invoice_signatory_photo_url'`);
        // Default values
        const defaultCompanyDetails = {
            companyName: 'Nefol',
            companyAddress: '',
            companyPhone: '7355384939',
            companyEmail: 'info@nefol.com',
            gstNumber: '',
            panNumber: '',
            bankName: '',
            accountNumber: '',
            ifscCode: ''
        };
        const defaultTaxSettings = { rate: 18, type: 'IGST' };
        const defaultTerms = 'Thank you for doing business with us.';
        const defaultSignature = 'Authorized Signatory';
        const defaultCurrency = '₹';
        // Parse settings
        let companyDetails = defaultCompanyDetails;
        if (companyDetailsResult.rows.length > 0 && companyDetailsResult.rows[0].setting_value) {
            const fetchedDetails = typeof companyDetailsResult.rows[0].setting_value === 'string'
                ? JSON.parse(companyDetailsResult.rows[0].setting_value)
                : companyDetailsResult.rows[0].setting_value;
            companyDetails = { ...defaultCompanyDetails, ...fetchedDetails };
        }
        let taxSettings = defaultTaxSettings;
        if (taxResult.rows.length > 0 && taxResult.rows[0].setting_value) {
            taxSettings = typeof taxResult.rows[0].setting_value === 'string'
                ? JSON.parse(taxResult.rows[0].setting_value)
                : taxResult.rows[0].setting_value;
        }
        const terms = termsResult.rows.length > 0 && termsResult.rows[0].setting_value
            ? termsResult.rows[0].setting_value
            : defaultTerms;
        const signature = signatureResult.rows.length > 0 && signatureResult.rows[0].setting_value
            ? signatureResult.rows[0].setting_value
            : defaultSignature;
        const currency = currencyResult.rows.length > 0 && currencyResult.rows[0].setting_value
            ? currencyResult.rows[0].setting_value
            : defaultCurrency;
        let logoUrl = null;
        if (logoResult.rows.length > 0 && logoResult.rows[0].setting_value) {
            logoUrl = logoResult.rows[0].setting_value;
            if (logoUrl && !logoUrl.startsWith('http')) {
                logoUrl = logoUrl.startsWith('/') ? `${baseUrl}${logoUrl}` : `${baseUrl}/${logoUrl}`;
            }
        }
        let signatoryPhotoUrl = null;
        if (signatoryPhotoResult.rows.length > 0 && signatoryPhotoResult.rows[0].setting_value) {
            signatoryPhotoUrl = signatoryPhotoResult.rows[0].setting_value;
            if (signatoryPhotoUrl && !signatoryPhotoUrl.startsWith('http')) {
                signatoryPhotoUrl = signatoryPhotoUrl.startsWith('/') ? `${baseUrl}${signatoryPhotoUrl}` : `${baseUrl}/${signatoryPhotoUrl}`;
            }
        }
        // Fetch Shiprocket shipment details for invoice
        let shipmentInfo = null;
        try {
            const shipmentResult = await pool.query('SELECT shipment_id, tracking_url, awb_code, status FROM shiprocket_shipments WHERE order_id = $1 ORDER BY id DESC LIMIT 1', [order.id]);
            if (shipmentResult.rows.length > 0) {
                shipmentInfo = shipmentResult.rows[0];
            }
        }
        catch (shipmentErr) {
            console.error('Error fetching Shiprocket shipment info for invoice PDF:', shipmentErr);
        }
        // Generate invoice HTML
        const invoiceHtml = (0, amazonInvoiceTemplate_1.generateAmazonInvoiceHTML)(order, companyDetails, taxSettings, terms, signature, currency, logoUrl, signatoryPhotoUrl, shipmentInfo);
        // Launch Puppeteer browser with additional args for server environments
        browser = await puppeteer_1.default.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--disable-software-rasterizer'
            ],
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
        });
        const page = await browser.newPage();
        // Set content and wait for resources to load
        await page.setContent(invoiceHtml, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });
        // Generate PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '15mm',
                bottom: '20mm',
                left: '15mm'
            }
        });
        await browser.close();
        return pdfBuffer;
    }
    catch (error) {
        if (browser) {
            await browser.close();
        }
        console.error('Error generating invoice PDF:', error);
        throw error;
    }
}

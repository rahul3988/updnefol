"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInventorySummary = getInventorySummary;
exports.adjustStock = adjustStock;
exports.setLowStockThreshold = setLowStockThreshold;
exports.listLowStock = listLowStock;
exports.getAllProductsWithInventory = getAllProductsWithInventory;
exports.setStockQuantity = setStockQuantity;
const apiHelpers_1 = require("../utils/apiHelpers");
async function getInventorySummary(pool, req, res) {
    try {
        const { productId } = req.params;
        const { rows } = await pool.query(`select p.id as product_id, p.title,
              coalesce(sum(i.quantity - i.reserved), 0) as available,
              coalesce(sum(i.quantity), 0) as total,
              count(*) filter (where (i.quantity - i.reserved) <= coalesce(i.low_stock_threshold, 0)) as low_variants
       from products p
       left join product_variants pv on pv.product_id = p.id
       left join inventory i on i.variant_id = pv.id
       where p.id = $1
       group by p.id`, [productId]);
        (0, apiHelpers_1.sendSuccess)(res, rows[0] || { product_id: Number(productId), available: 0, total: 0, low_variants: 0 });
    }
    catch (err) {
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to fetch inventory summary', err);
    }
}
async function adjustStock(pool, req, res) {
    try {
        const { productId, variantId } = req.params;
        const { delta, reason = 'manual_adjustment', metadata } = req.body || {};
        const validationError = (0, apiHelpers_1.validateRequired)({ delta }, ['delta']);
        if (validationError)
            return (0, apiHelpers_1.sendError)(res, 400, validationError);
        // Ensure row exists
        await pool.query(`insert into inventory (product_id, variant_id, quantity, reserved, low_stock_threshold)
       values ($1, $2, 0, 0, 0)
       on conflict (product_id, variant_id) do nothing`, [productId, variantId]);
        const { rows } = await pool.query(`update inventory set quantity = quantity + $3, updated_at = now()
       where product_id = $1 and variant_id = $2
       returning *`, [productId, variantId, Number(delta)]);
        await pool.query(`insert into inventory_logs (product_id, variant_id, change, reason, metadata)
       values ($1, $2, $3, $4, $5)`, [productId, variantId, Number(delta), reason, metadata ? JSON.stringify(metadata) : null]);
        (0, apiHelpers_1.sendSuccess)(res, rows[0]);
    }
    catch (err) {
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to adjust stock', err);
    }
}
async function setLowStockThreshold(pool, req, res) {
    try {
        const { productId, variantId } = req.params;
        const { threshold } = req.body || {};
        const validationError = (0, apiHelpers_1.validateRequired)({ threshold }, ['threshold']);
        if (validationError)
            return (0, apiHelpers_1.sendError)(res, 400, validationError);
        const { rows } = await pool.query(`update inventory set low_stock_threshold = $3, updated_at = now()
       where product_id = $1 and variant_id = $2
       returning *`, [productId, variantId, Number(threshold)]);
        (0, apiHelpers_1.sendSuccess)(res, rows[0] || null);
    }
    catch (err) {
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to set low stock threshold', err);
    }
}
async function listLowStock(pool, req, res) {
    try {
        const { rows } = await pool.query(`select pv.id as variant_id, pv.product_id, pv.sku, pv.attributes,
              i.quantity, i.reserved, i.low_stock_threshold
       from product_variants pv
       join inventory i on i.variant_id = pv.id
       where (i.quantity - i.reserved) <= coalesce(i.low_stock_threshold, 0)
       order by (i.quantity - i.reserved) asc`);
        (0, apiHelpers_1.sendSuccess)(res, rows);
    }
    catch (err) {
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to list low stock variants', err);
    }
}
async function getAllProductsWithInventory(pool, req, res) {
    try {
        const { search, lowStockOnly } = req.query;
        let whereClause = '';
        const params = [];
        if (search) {
            whereClause += ` AND (p.title ILIKE $${params.length + 1} OR p.slug ILIKE $${params.length + 1})`;
            params.push(`%${search}%`);
        }
        if (lowStockOnly === 'true') {
            whereClause += ` AND (i.quantity - COALESCE(i.reserved, 0)) <= COALESCE(i.low_stock_threshold, 0)`;
        }
        const { rows } = await pool.query(`
      SELECT 
        p.id as product_id,
        p.title,
        p.slug,
        p.price,
        p.list_image,
        COALESCE(
          json_agg(
            json_build_object(
              'id', pv.id,
              'sku', pv.sku,
              'attributes', pv.attributes,
              'price', pv.price,
              'mrp', pv.mrp,
              'is_active', pv.is_active,
              'quantity', COALESCE(i.quantity, 0),
              'reserved', COALESCE(i.reserved, 0),
              'available', COALESCE(i.quantity, 0) - COALESCE(i.reserved, 0),
              'low_stock_threshold', COALESCE(i.low_stock_threshold, 0),
              'is_low_stock', (COALESCE(i.quantity, 0) - COALESCE(i.reserved, 0)) <= COALESCE(i.low_stock_threshold, 0)
            ) ORDER BY pv.id
          ) FILTER (WHERE pv.id IS NOT NULL),
          '[]'::json
        ) as variants,
        COALESCE(SUM(i.quantity), 0) as total_stock,
        COALESCE(SUM(i.quantity - COALESCE(i.reserved, 0)), 0) as total_available,
        COUNT(*) FILTER (WHERE (i.quantity - COALESCE(i.reserved, 0)) <= COALESCE(i.low_stock_threshold, 0)) as low_stock_variants_count
      FROM products p
      LEFT JOIN product_variants pv ON pv.product_id = p.id
      LEFT JOIN inventory i ON i.variant_id = pv.id AND i.product_id = p.id
      WHERE 1=1 ${whereClause}
      GROUP BY p.id, p.title, p.slug, p.price, p.list_image
      ORDER BY p.title ASC
    `, params);
        (0, apiHelpers_1.sendSuccess)(res, rows);
    }
    catch (err) {
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to fetch products with inventory', err);
    }
}
async function setStockQuantity(pool, req, res) {
    try {
        const { productId, variantId } = req.params;
        const { quantity, reason = 'manual_update', metadata } = req.body || {};
        const validationError = (0, apiHelpers_1.validateRequired)({ quantity }, ['quantity']);
        if (validationError)
            return (0, apiHelpers_1.sendError)(res, 400, validationError);
        // Ensure row exists
        await pool.query(`insert into inventory (product_id, variant_id, quantity, reserved, low_stock_threshold)
       values ($1, $2, 0, 0, 0)
       on conflict (product_id, variant_id) do nothing`, [productId, variantId]);
        // Get current quantity to calculate delta
        const { rows: currentRows } = await pool.query(`SELECT quantity FROM inventory WHERE product_id = $1 AND variant_id = $2`, [productId, variantId]);
        const currentQuantity = currentRows[0]?.quantity || 0;
        const delta = Number(quantity) - currentQuantity;
        const { rows } = await pool.query(`update inventory set quantity = $3, updated_at = now()
       where product_id = $1 and variant_id = $2
       returning *`, [productId, variantId, Number(quantity)]);
        await pool.query(`insert into inventory_logs (product_id, variant_id, change, reason, metadata)
       values ($1, $2, $3, $4, $5)`, [productId, variantId, delta, reason, metadata ? JSON.stringify(metadata) : null]);
        (0, apiHelpers_1.sendSuccess)(res, rows[0]);
    }
    catch (err) {
        (0, apiHelpers_1.sendError)(res, 500, 'Failed to set stock quantity', err);
    }
}

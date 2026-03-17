"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const db_1 = require("../lib/db");
const router = (0, express_1.Router)();
const checkoutSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(3).max(120),
    phone: zod_1.z.string().min(6).max(30),
    email: zod_1.z.string().email(),
    comment: zod_1.z.string().max(500).optional(),
    address: zod_1.z.string().max(500).optional(),
    pickupMethod: zod_1.z.string().max(120).optional(),
    items: zod_1.z
        .array(zod_1.z.object({
        productId: zod_1.z.number().int().positive(),
        quantity: zod_1.z.number().int().positive().max(99),
    }))
        .optional(),
});
router.post("/", auth_1.optionalAuth, async (req, res, next) => {
    try {
        const body = checkoutSchema.parse(req.body);
        let sourceItems = [];
        if (req.user) {
            const cart = await (0, db_1.queryOne)("SELECT id FROM carts WHERE user_id = $1", [req.user.id]);
            if (cart) {
                sourceItems = await (0, db_1.query)('SELECT product_id as "productId", quantity FROM cart_items WHERE cart_id = $1', [cart.id]);
            }
        }
        else {
            sourceItems = body.items ?? [];
        }
        if (!sourceItems.length) {
            return res.status(400).json({ message: "No items to checkout" });
        }
        const normalizedItemsMap = new Map();
        for (const item of sourceItems) {
            normalizedItemsMap.set(item.productId, (normalizedItemsMap.get(item.productId) ?? 0) + item.quantity);
        }
        const normalizedItems = Array.from(normalizedItemsMap.entries()).map(([productId, quantity]) => ({
            productId,
            quantity,
        }));
        const order = await (0, db_1.withTransaction)(async (client) => {
            const orderItemRows = [];
            for (const item of normalizedItems) {
                const product = await (0, db_1.queryOne)('SELECT id, name, sku, price, stock, is_available as "isAvailable" FROM products WHERE id = $1 FOR UPDATE', [item.productId], client);
                if (!product)
                    continue;
                const availableStock = product.isAvailable ? Math.max(product.stock, 0) : 0;
                if (item.quantity > availableStock) {
                    const error = new Error("Requested quantity exceeds available stock");
                    error.status = 409;
                    error.code = "STOCK_EXCEEDED";
                    error.productId = item.productId;
                    error.requestedQuantity = item.quantity;
                    error.availableStock = availableStock;
                    throw error;
                }
                orderItemRows.push({
                    productId: product.id,
                    snapshotName: product.name,
                    snapshotSku: product.sku,
                    price: product.price,
                    quantity: item.quantity,
                    lineTotal: product.price * item.quantity,
                });
            }
            if (!orderItemRows.length) {
                throw new Error("No valid products for checkout");
            }
            const total = orderItemRows.reduce((sum, entry) => sum + entry.lineTotal, 0);
            const createdOrder = await (0, db_1.queryOne)(`INSERT INTO orders (user_id, status, full_name, phone, email, comment, address, pickup_method, total)
         VALUES ($1, 'PENDING', $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`, [
                req.user?.id ?? null,
                body.fullName,
                body.phone,
                body.email,
                body.comment ?? null,
                body.address ?? null,
                body.pickupMethod ?? null,
                total,
            ], client);
            if (!createdOrder) {
                throw new Error("Could not create order");
            }
            const orderId = createdOrder.id;
            for (const row of orderItemRows) {
                await (0, db_1.query)(`INSERT INTO order_items (order_id, product_id, snapshot_name, snapshot_sku, price, quantity, line_total)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
                    orderId,
                    row.productId,
                    row.snapshotName,
                    row.snapshotSku,
                    row.price,
                    row.quantity,
                    row.lineTotal,
                ], client);
            }
            for (const row of orderItemRows) {
                await (0, db_1.query)("UPDATE products SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [row.quantity, row.productId], client);
            }
            if (req.user) {
                const cart = await (0, db_1.queryOne)("SELECT id FROM carts WHERE user_id = $1", [req.user.id], client);
                if (cart) {
                    await (0, db_1.query)("DELETE FROM cart_items WHERE cart_id = $1", [cart.id], client);
                }
            }
            const order = await (0, db_1.queryOne)("SELECT * FROM orders WHERE id = $1", [orderId], client);
            const items = await (0, db_1.query)("SELECT * FROM order_items WHERE order_id = $1", [orderId], client);
            return { ...(order ?? {}), items };
        });
        res.status(201).json(order);
    }
    catch (error) {
        next(error);
    }
});
router.get("/my", auth_1.authRequired, async (req, res, next) => {
    try {
        const orders = await (0, db_1.query)("SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC", [req.user.id]);
        const data = await Promise.all(orders.map(async (order) => ({
            ...order,
            items: await (0, db_1.query)("SELECT * FROM order_items WHERE order_id = $1", [order.id]),
        })));
        res.json(data);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const db_1 = require("../lib/db");
const router = (0, express_1.Router)();
const CART_MAX_QUANTITY = 99;
const addItemSchema = zod_1.z.object({
    productId: zod_1.z.number().int().positive(),
    quantity: zod_1.z.number().int().positive().max(CART_MAX_QUANTITY).default(1),
});
const updateItemSchema = zod_1.z.object({
    quantity: zod_1.z.number().int().positive().max(CART_MAX_QUANTITY),
});
const syncSchema = zod_1.z.object({
    items: zod_1.z.array(zod_1.z.object({
        productId: zod_1.z.number().int().positive(),
        quantity: zod_1.z.number().int().positive().max(CART_MAX_QUANTITY),
    })),
});
const ensureCart = async (userId) => {
    const cart = await (0, db_1.queryOne)("SELECT * FROM carts WHERE user_id = $1", [userId]);
    if (cart)
        return cart;
    const created = await (0, db_1.queryOne)("INSERT INTO carts (user_id) VALUES ($1) RETURNING id", [userId]);
    if (!created) {
        throw new Error("Failed to create cart");
    }
    return { id: created.id, user_id: userId };
};
const parsePositiveInt = (raw) => {
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
const getProductStock = (productId) => (0, db_1.queryOne)('SELECT id, stock, is_available as "isAvailable" FROM products WHERE id = $1', [productId]);
const getAvailableStock = (product) => product.isAvailable ? Math.max(product.stock, 0) : 0;
const stockExceededPayload = (productId, requestedQuantity, availableStock) => ({
    code: "CART_STOCK_EXCEEDED",
    message: "Requested quantity exceeds available stock",
    productId,
    requestedQuantity,
    availableStock,
});
router.use(auth_1.authRequired);
router.get("/", async (req, res, next) => {
    try {
        const cart = await ensureCart(req.user.id);
        const items = await (0, db_1.query)(`SELECT ci.*,
              p.name, p.slug, p.price, p.image, p.sku, p.stock,
              b.name as "brandName",
              c.name as "categoryName"
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       JOIN brands b ON b.id = p.brand_id
       JOIN categories c ON c.id = p.category_id
       WHERE ci.cart_id = $1
       ORDER BY ci.created_at DESC`, [cart.id]);
        const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        res.json({ id: cart.id, userId: req.user.id, items, total });
    }
    catch (error) {
        next(error);
    }
});
router.post("/items", async (req, res, next) => {
    try {
        const body = addItemSchema.parse(req.body);
        const cart = await ensureCart(req.user.id);
        const product = await getProductStock(body.productId);
        if (!product)
            return res.status(404).json({ message: "Product not found" });
        const availableStock = getAvailableStock(product);
        const existing = await (0, db_1.queryOne)("SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2", [cart.id, body.productId]);
        const nextQuantity = (existing?.quantity ?? 0) + body.quantity;
        if (nextQuantity > availableStock) {
            return res.status(409).json(stockExceededPayload(body.productId, nextQuantity, availableStock));
        }
        if (existing) {
            await (0, db_1.query)("UPDATE cart_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [
                nextQuantity,
                existing.id,
            ]);
        }
        else {
            await (0, db_1.query)("INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)", [
                cart.id,
                body.productId,
                body.quantity,
            ]);
        }
        res.status(201).json({ message: "Added to cart" });
    }
    catch (error) {
        next(error);
    }
});
router.patch("/items/:itemId", async (req, res, next) => {
    try {
        const itemId = parsePositiveInt(req.params.itemId);
        if (!itemId) {
            return res.status(400).json({ message: "Invalid cart item id" });
        }
        const body = updateItemSchema.parse(req.body);
        const item = await (0, db_1.queryOne)(`SELECT ci.id, ci.product_id as "productId", c.user_id as "userId"
       FROM cart_items ci
       JOIN carts c ON c.id = ci.cart_id
       WHERE ci.id = $1`, [itemId]);
        if (!item || item.userId !== req.user.id) {
            return res.status(404).json({ message: "Cart item not found" });
        }
        const product = await getProductStock(item.productId);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        const availableStock = getAvailableStock(product);
        if (body.quantity > availableStock) {
            return res
                .status(409)
                .json(stockExceededPayload(item.productId, body.quantity, availableStock));
        }
        await (0, db_1.query)("UPDATE cart_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [
            body.quantity,
            itemId,
        ]);
        res.json({ message: "Cart item updated" });
    }
    catch (error) {
        next(error);
    }
});
router.delete("/items/:itemId", async (req, res, next) => {
    try {
        const itemId = parsePositiveInt(req.params.itemId);
        if (!itemId) {
            return res.status(400).json({ message: "Invalid cart item id" });
        }
        const item = await (0, db_1.queryOne)(`SELECT ci.id, c.user_id as "userId"
       FROM cart_items ci
       JOIN carts c ON c.id = ci.cart_id
       WHERE ci.id = $1`, [itemId]);
        if (!item || item.userId !== req.user.id) {
            return res.status(404).json({ message: "Cart item not found" });
        }
        await (0, db_1.query)("DELETE FROM cart_items WHERE id = $1", [itemId]);
        res.json({ message: "Item removed from cart" });
    }
    catch (error) {
        next(error);
    }
});
router.post("/sync", async (req, res, next) => {
    try {
        const body = syncSchema.parse(req.body);
        const cart = await ensureCart(req.user.id);
        const existingRows = await (0, db_1.query)('SELECT id, product_id as "productId", quantity FROM cart_items WHERE cart_id = $1', [cart.id]);
        const existingByProduct = new Map(existingRows.map((row) => [row.productId, row]));
        const incomingByProduct = new Map();
        for (const item of body.items) {
            incomingByProduct.set(item.productId, (incomingByProduct.get(item.productId) ?? 0) + item.quantity);
        }
        for (const [productId, incomingQuantity] of incomingByProduct) {
            const product = await getProductStock(productId);
            if (!product)
                continue;
            const current = existingByProduct.get(productId)?.quantity ?? 0;
            const requested = current + incomingQuantity;
            const availableStock = getAvailableStock(product);
            if (requested > availableStock) {
                return res
                    .status(409)
                    .json(stockExceededPayload(productId, requested, availableStock));
            }
        }
        await (0, db_1.withTransaction)(async (client) => {
            for (const item of body.items) {
                const product = await getProductStock(item.productId);
                if (!product)
                    continue;
                const existing = existingByProduct.get(item.productId);
                const nextQuantity = (existing?.quantity ?? 0) + item.quantity;
                if (existing) {
                    await (0, db_1.query)("UPDATE cart_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [nextQuantity, existing.id], client);
                    existingByProduct.set(item.productId, { ...existing, quantity: nextQuantity });
                }
                else {
                    const created = await (0, db_1.queryOne)("INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3) RETURNING id", [cart.id, item.productId, nextQuantity], client);
                    if (!created) {
                        continue;
                    }
                    existingByProduct.set(item.productId, { id: created.id, productId: item.productId, quantity: nextQuantity });
                }
            }
        });
        res.json({ message: "Cart synced" });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;

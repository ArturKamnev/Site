"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../lib/db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const addItemSchema = zod_1.z.object({
    productId: zod_1.z.number().int().positive(),
});
const syncSchema = zod_1.z.object({
    productIds: zod_1.z.array(zod_1.z.number().int().positive()).max(200),
});
const favoritesQuery = `
  SELECT f.id as "favoriteId",
         f.product_id as "productId",
         f.created_at as "createdAt",
         p.*,
         CASE WHEN p.is_available THEN 1 ELSE 0 END as is_available,
         b.name as "brandName",
         b.slug as "brandSlug",
         c.name as "categoryName",
         c.slug as "categorySlug"
  FROM favorites f
  JOIN products p ON p.id = f.product_id
  JOIN brands b ON b.id = p.brand_id
  JOIN categories c ON c.id = p.category_id
  WHERE f.user_id = $1
  ORDER BY f.created_at DESC
`;
const getFavorites = (userId) => (0, db_1.query)(favoritesQuery, [userId]);
router.use(auth_1.authRequired);
router.get("/", async (req, res, next) => {
    try {
        const items = await getFavorites(req.user.id);
        res.json({ items });
    }
    catch (error) {
        next(error);
    }
});
router.post("/items", async (req, res, next) => {
    try {
        const body = addItemSchema.parse(req.body);
        const product = await (0, db_1.queryOne)("SELECT id FROM products WHERE id = $1", [body.productId]);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        await (0, db_1.query)("INSERT INTO favorites (user_id, product_id) VALUES ($1, $2) ON CONFLICT (user_id, product_id) DO NOTHING", [req.user.id, body.productId]);
        res.status(201).json({ message: "Added to favorites" });
    }
    catch (error) {
        next(error);
    }
});
router.delete("/items/:productId", async (req, res, next) => {
    try {
        const productId = Number(req.params.productId);
        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({ message: "Invalid product id" });
        }
        await (0, db_1.query)("DELETE FROM favorites WHERE user_id = $1 AND product_id = $2", [req.user.id, productId]);
        res.json({ message: "Removed from favorites" });
    }
    catch (error) {
        next(error);
    }
});
router.post("/sync", async (req, res, next) => {
    try {
        const body = syncSchema.parse(req.body);
        await (0, db_1.withTransaction)(async (client) => {
            for (const productId of body.productIds) {
                const product = await (0, db_1.queryOne)("SELECT id FROM products WHERE id = $1", [productId], client);
                if (!product)
                    continue;
                await (0, db_1.query)("INSERT INTO favorites (user_id, product_id) VALUES ($1, $2) ON CONFLICT (user_id, product_id) DO NOTHING", [req.user.id, productId], client);
            }
        });
        res.json({ items: await getFavorites(req.user.id) });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;

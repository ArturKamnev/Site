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
  SELECT f.id as favoriteId,
         f.product_id as productId,
         f.created_at as createdAt,
         p.*,
         b.name as brandName,
         b.slug as brandSlug,
         c.name as categoryName,
         c.slug as categorySlug
  FROM favorites f
  JOIN products p ON p.id = f.product_id
  JOIN brands b ON b.id = p.brand_id
  JOIN categories c ON c.id = p.category_id
  WHERE f.user_id = ?
  ORDER BY f.created_at DESC
`;
const getFavorites = (userId) => db_1.db.prepare(favoritesQuery).all(userId);
router.use(auth_1.authRequired);
router.get("/", (req, res, next) => {
    try {
        const items = getFavorites(req.user.id);
        res.json({ items });
    }
    catch (error) {
        next(error);
    }
});
router.post("/items", (req, res, next) => {
    try {
        const body = addItemSchema.parse(req.body);
        const product = db_1.db.prepare("SELECT id FROM products WHERE id = ?").get(body.productId);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        db_1.db.prepare("INSERT OR IGNORE INTO favorites (user_id, product_id) VALUES (?, ?)").run(req.user.id, body.productId);
        res.status(201).json({ message: "Added to favorites" });
    }
    catch (error) {
        next(error);
    }
});
router.delete("/items/:productId", (req, res, next) => {
    try {
        const productId = Number(req.params.productId);
        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({ message: "Invalid product id" });
        }
        db_1.db.prepare("DELETE FROM favorites WHERE user_id = ? AND product_id = ?").run(req.user.id, productId);
        res.json({ message: "Removed from favorites" });
    }
    catch (error) {
        next(error);
    }
});
router.post("/sync", (req, res, next) => {
    try {
        const body = syncSchema.parse(req.body);
        const insertFavorite = db_1.db.prepare("INSERT OR IGNORE INTO favorites (user_id, product_id) VALUES (?, ?)");
        const checkProduct = db_1.db.prepare("SELECT id FROM products WHERE id = ?");
        const tx = db_1.db.transaction((productIds) => {
            for (const productId of productIds) {
                const product = checkProduct.get(productId);
                if (!product)
                    continue;
                insertFavorite.run(req.user.id, productId);
            }
        });
        tx(body.productIds);
        res.json({ items: getFavorites(req.user.id) });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;

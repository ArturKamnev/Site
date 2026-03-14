"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../lib/db");
const router = (0, express_1.Router)();
router.get("/", (req, res, next) => {
    try {
        const search = req.query.search?.trim();
        const page = Math.max(Number(req.query.page ?? 1), 1);
        const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? 12), 1), 60);
        const where = search ? "WHERE p.name LIKE ? OR p.sku LIKE ? OR p.article LIKE ?" : "";
        const params = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];
        const total = db_1.db
            .prepare(`SELECT COUNT(*) as count FROM products p ${where}`)
            .get(...params);
        const items = db_1.db
            .prepare(`SELECT p.*,
                b.name as brandName, b.slug as brandSlug,
                c.name as categoryName, c.slug as categorySlug
         FROM products p
         JOIN brands b ON b.id = p.brand_id
         JOIN categories c ON c.id = p.category_id
         ${where}
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?`)
            .all(...params, pageSize, (page - 1) * pageSize);
        res.json({
            items,
            pagination: {
                total: total.count,
                page,
                pageSize,
                totalPages: Math.max(Math.ceil(total.count / pageSize), 1),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
router.get("/:slug", (req, res, next) => {
    try {
        const product = db_1.db
            .prepare(`SELECT p.*,
                b.name as brandName, b.slug as brandSlug, b.id as brandId,
                c.name as categoryName, c.slug as categorySlug, c.id as categoryId
         FROM products p
         JOIN brands b ON b.id = p.brand_id
         JOIN categories c ON c.id = p.category_id
         WHERE p.slug = ?`)
            .get(req.params.slug);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        const images = db_1.db
            .prepare("SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC")
            .all(product.id);
        res.json({ ...product, images });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;

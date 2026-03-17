"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../lib/db");
const router = (0, express_1.Router)();
router.get("/", async (req, res, next) => {
    try {
        const search = req.query.search?.trim();
        const page = Math.max(Number(req.query.page ?? 1), 1);
        const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? 12), 1), 60);
        const where = search ? "WHERE p.name ILIKE $1 OR p.sku ILIKE $2 OR p.article ILIKE $3" : "";
        const params = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];
        const paginationParams = [...params, pageSize, (page - 1) * pageSize];
        const total = await (0, db_1.queryOne)(`SELECT COUNT(*) as count FROM products p ${where}`, params);
        const limitParam = params.length + 1;
        const offsetParam = params.length + 2;
        const items = await (0, db_1.query)(`SELECT p.*,
              CASE WHEN p.is_available THEN 1 ELSE 0 END as is_available,
              b.name as "brandName", b.slug as "brandSlug",
              c.name as "categoryName", c.slug as "categorySlug"
       FROM products p
       JOIN brands b ON b.id = p.brand_id
       JOIN categories c ON c.id = p.category_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`, paginationParams);
        const totalCount = Number(total?.count ?? 0);
        res.json({
            items,
            pagination: {
                total: totalCount,
                page,
                pageSize,
                totalPages: Math.max(Math.ceil(totalCount / pageSize), 1),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
router.get("/:slug", async (req, res, next) => {
    try {
        const product = await (0, db_1.queryOne)(`SELECT p.*,
              CASE WHEN p.is_available THEN 1 ELSE 0 END as is_available,
              b.name as "brandName", b.slug as "brandSlug", b.id as "brandId",
              c.name as "categoryName", c.slug as "categorySlug", c.id as "categoryId"
       FROM products p
       JOIN brands b ON b.id = p.brand_id
       JOIN categories c ON c.id = p.category_id
       WHERE p.slug = $1`, [req.params.slug]);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        const images = await (0, db_1.query)("SELECT * FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC", [product.id]);
        res.json({ ...product, images });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;

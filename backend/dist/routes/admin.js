"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const db_1 = require("../lib/db");
const slugify_1 = require("../utils/slugify");
const router = (0, express_1.Router)();
const ORDER_STATUS = ["PENDING", "PROCESSING", "SHIPPED", "COMPLETED", "CANCELED"];
router.use(auth_1.authRequired, (0, auth_1.rolesRequired)("admin", "employee"));
const brandSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(120),
    slug: zod_1.z.string().min(2).max(120).optional(),
    logoUrl: zod_1.z.string().url().optional().or(zod_1.z.literal("")),
    description: zod_1.z.string().max(400).optional(),
});
const categorySchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(120),
    slug: zod_1.z.string().min(2).max(120).optional(),
    description: zod_1.z.string().max(400).optional(),
});
const productSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(200),
    slug: zod_1.z.string().min(2).max(200).optional(),
    sku: zod_1.z.string().min(1).max(100),
    article: zod_1.z.string().max(120).optional(),
    partId: zod_1.z.string().max(120).optional(),
    price: zod_1.z.number().nonnegative(),
    image: zod_1.z.string().url().optional().or(zod_1.z.literal("")),
    description: zod_1.z.string().optional(),
    manufacturer: zod_1.z.string().max(120).optional(),
    stock: zod_1.z.number().int().nonnegative(),
    isAvailable: zod_1.z.boolean().optional().default(true),
    brandId: zod_1.z.number().int().positive(),
    categoryId: zod_1.z.number().int().positive(),
    specsJson: zod_1.z.string().optional(),
});
router.get("/dashboard", (_req, res, next) => {
    try {
        const users = db_1.db.prepare("SELECT COUNT(*) as c FROM users").get().c;
        const products = db_1.db.prepare("SELECT COUNT(*) as c FROM products").get().c;
        const brands = db_1.db.prepare("SELECT COUNT(*) as c FROM brands").get().c;
        const categories = db_1.db.prepare("SELECT COUNT(*) as c FROM categories").get().c;
        const orders = db_1.db.prepare("SELECT COUNT(*) as c FROM orders").get().c;
        res.json({ users, products, brands, categories, orders });
    }
    catch (error) {
        next(error);
    }
});
router.get("/products", (_req, res, next) => {
    try {
        const items = db_1.db
            .prepare(`SELECT p.*,
                b.name as brandName,
                c.name as categoryName
         FROM products p
         JOIN brands b ON b.id = p.brand_id
         JOIN categories c ON c.id = p.category_id
         ORDER BY p.created_at DESC`)
            .all();
        res.json(items);
    }
    catch (error) {
        next(error);
    }
});
router.post("/products", (req, res, next) => {
    try {
        const body = productSchema.parse(req.body);
        const result = db_1.db
            .prepare(`INSERT INTO products
         (name, slug, sku, article, part_id, price, image, description, manufacturer, stock, is_available, brand_id, category_id, specs_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(body.name, body.slug ? (0, slugify_1.slugify)(body.slug) : (0, slugify_1.slugify)(body.name), body.sku, body.article ?? null, body.partId ?? null, body.price, body.image || null, body.description ?? null, body.manufacturer ?? null, body.stock, body.isAvailable ? 1 : 0, body.brandId, body.categoryId, body.specsJson ?? null);
        res.status(201).json({ id: Number(result.lastInsertRowid) });
    }
    catch (error) {
        next(error);
    }
});
router.put("/products/:id", (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const body = productSchema.parse(req.body);
        db_1.db.prepare(`UPDATE products
       SET name = ?, slug = ?, sku = ?, article = ?, part_id = ?, price = ?, image = ?, description = ?, manufacturer = ?,
           stock = ?, is_available = ?, brand_id = ?, category_id = ?, specs_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`).run(body.name, body.slug ? (0, slugify_1.slugify)(body.slug) : (0, slugify_1.slugify)(body.name), body.sku, body.article ?? null, body.partId ?? null, body.price, body.image || null, body.description ?? null, body.manufacturer ?? null, body.stock, body.isAvailable ? 1 : 0, body.brandId, body.categoryId, body.specsJson ?? null, id);
        res.json({ message: "Product updated" });
    }
    catch (error) {
        next(error);
    }
});
router.delete("/products/:id", (req, res, next) => {
    try {
        db_1.db.prepare("DELETE FROM products WHERE id = ?").run(Number(req.params.id));
        res.json({ message: "Product deleted" });
    }
    catch (error) {
        next(error);
    }
});
router.get("/brands", (_req, res, next) => {
    try {
        res.json(db_1.db.prepare("SELECT * FROM brands ORDER BY name ASC").all());
    }
    catch (error) {
        next(error);
    }
});
router.post("/brands", (req, res, next) => {
    try {
        const body = brandSchema.parse(req.body);
        const result = db_1.db
            .prepare("INSERT INTO brands (name, slug, logo_url, description) VALUES (?, ?, ?, ?)")
            .run(body.name, body.slug ? (0, slugify_1.slugify)(body.slug) : (0, slugify_1.slugify)(body.name), body.logoUrl || null, body.description ?? null);
        res.status(201).json({ id: Number(result.lastInsertRowid) });
    }
    catch (error) {
        next(error);
    }
});
router.put("/brands/:id", (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const body = brandSchema.parse(req.body);
        db_1.db.prepare(`UPDATE brands
       SET name = ?, slug = ?, logo_url = ?, description = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`).run(body.name, body.slug ? (0, slugify_1.slugify)(body.slug) : (0, slugify_1.slugify)(body.name), body.logoUrl || null, body.description ?? null, id);
        res.json({ message: "Brand updated" });
    }
    catch (error) {
        next(error);
    }
});
router.delete("/brands/:id", (req, res, next) => {
    try {
        db_1.db.prepare("DELETE FROM brands WHERE id = ?").run(Number(req.params.id));
        res.json({ message: "Brand deleted" });
    }
    catch (error) {
        next(error);
    }
});
router.get("/categories", (_req, res, next) => {
    try {
        res.json(db_1.db.prepare("SELECT * FROM categories ORDER BY name ASC").all());
    }
    catch (error) {
        next(error);
    }
});
router.post("/categories", (req, res, next) => {
    try {
        const body = categorySchema.parse(req.body);
        const result = db_1.db
            .prepare("INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)")
            .run(body.name, body.slug ? (0, slugify_1.slugify)(body.slug) : (0, slugify_1.slugify)(body.name), body.description ?? null);
        res.status(201).json({ id: Number(result.lastInsertRowid) });
    }
    catch (error) {
        next(error);
    }
});
router.put("/categories/:id", (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const body = categorySchema.parse(req.body);
        db_1.db.prepare(`UPDATE categories
       SET name = ?, slug = ?, description = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`).run(body.name, body.slug ? (0, slugify_1.slugify)(body.slug) : (0, slugify_1.slugify)(body.name), body.description ?? null, id);
        res.json({ message: "Category updated" });
    }
    catch (error) {
        next(error);
    }
});
router.delete("/categories/:id", (req, res, next) => {
    try {
        db_1.db.prepare("DELETE FROM categories WHERE id = ?").run(Number(req.params.id));
        res.json({ message: "Category deleted" });
    }
    catch (error) {
        next(error);
    }
});
router.get("/orders", (_req, res, next) => {
    try {
        const orders = db_1.db
            .prepare(`SELECT o.*, u.email as userEmail, u.name as userName
         FROM orders o
         LEFT JOIN users u ON u.id = o.user_id
         ORDER BY o.created_at DESC`)
            .all();
        const itemsStmt = db_1.db.prepare("SELECT * FROM order_items WHERE order_id = ?");
        res.json(orders.map((order) => ({ ...order, items: itemsStmt.all(order.id) })));
    }
    catch (error) {
        next(error);
    }
});
router.patch("/orders/:id/status", (req, res, next) => {
    try {
        const statusSchema = zod_1.z.object({ status: zod_1.z.enum(ORDER_STATUS) });
        const { status } = statusSchema.parse(req.body);
        const id = Number(req.params.id);
        db_1.db.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, id);
        const order = db_1.db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
        res.json(order);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;

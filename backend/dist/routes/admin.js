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
    name: zod_1.z.string().trim().min(2).max(120),
    slug: zod_1.z.string().trim().min(2).max(120).optional(),
    logoUrl: zod_1.z.string().trim().url().optional().or(zod_1.z.literal("")),
    description: zod_1.z.string().trim().max(500).optional().or(zod_1.z.literal("")),
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
    discountPercent: zod_1.z.number().min(0).max(95).optional().default(0),
    image: zod_1.z.string().url().optional().or(zod_1.z.literal("")),
    description: zod_1.z.string().optional(),
    manufacturer: zod_1.z.string().max(120).optional(),
    stock: zod_1.z.number().int().nonnegative(),
    isAvailable: zod_1.z.boolean().optional().default(true),
    brandId: zod_1.z.number().int().positive(),
    categoryId: zod_1.z.number().int().positive(),
    specsJson: zod_1.z.string().optional(),
});
const discountSchema = zod_1.z.object({
    discountPercent: zod_1.z.number().min(0).max(95),
});
const heroSlideSchema = zod_1.z.object({
    label: zod_1.z.string().trim().min(1).max(80),
    imageUrl: zod_1.z.string().trim().url(),
    title: zod_1.z.string().trim().max(160).optional().or(zod_1.z.literal("")),
    subtitle: zod_1.z.string().trim().max(260).optional().or(zod_1.z.literal("")),
    buttonText: zod_1.z.string().trim().max(60).optional().or(zod_1.z.literal("")),
    buttonLink: zod_1.z.string().trim().max(300).optional().or(zod_1.z.literal("")),
    isActive: zod_1.z.boolean().optional().default(true),
});
const heroSlideUpdateSchema = heroSlideSchema.partial();
const normalizeBrandPayload = (body) => {
    const slug = body.slug ? (0, slugify_1.slugify)(body.slug) : (0, slugify_1.slugify)(body.name);
    return {
        name: body.name.trim(),
        slug,
        logoUrl: body.logoUrl?.trim() ? body.logoUrl.trim() : null,
        description: body.description?.trim() ? body.description.trim() : null,
    };
};
const normalizePricing = (price, discountPercent) => {
    if (!discountPercent || discountPercent <= 0) {
        return {
            price,
            oldPrice: null,
            discountPercent: null,
        };
    }
    const normalizedDiscount = Number(discountPercent.toFixed(2));
    const oldPrice = Number((price / (1 - normalizedDiscount / 100)).toFixed(2));
    return {
        price,
        oldPrice,
        discountPercent: normalizedDiscount,
    };
};
const normalizeHeroSlidePayload = (payload) => ({
    label: payload.label.trim(),
    imageUrl: payload.imageUrl.trim(),
    title: payload.title?.trim() ? payload.title.trim() : null,
    subtitle: payload.subtitle?.trim() ? payload.subtitle.trim() : null,
    buttonText: payload.buttonText?.trim() ? payload.buttonText.trim() : null,
    buttonLink: payload.buttonLink?.trim() ? payload.buttonLink.trim() : null,
    isActive: payload.isActive ? 1 : 0,
});
const compactHeroSlidePositions = () => {
    const slides = db_1.db.prepare("SELECT id FROM hero_slides ORDER BY position ASC").all();
    const shiftPosition = db_1.db.prepare("UPDATE hero_slides SET position = ? WHERE id = ?");
    for (const [index, slide] of slides.entries()) {
        shiftPosition.run(1000 + index, slide.id);
    }
    for (const [index, slide] of slides.entries()) {
        shiftPosition.run(index + 1, slide.id);
    }
};
router.get("/dashboard", (_req, res, next) => {
    try {
        const users = db_1.db.prepare("SELECT COUNT(*) as c FROM users").get().c;
        const products = db_1.db.prepare("SELECT COUNT(*) as c FROM products").get().c;
        const brands = db_1.db.prepare("SELECT COUNT(*) as c FROM brands").get().c;
        const categories = db_1.db.prepare("SELECT COUNT(*) as c FROM categories").get().c;
        const orders = db_1.db.prepare("SELECT COUNT(*) as c FROM orders").get().c;
        const heroSlides = db_1.db.prepare("SELECT COUNT(*) as c FROM hero_slides").get().c;
        res.json({ users, products, brands, categories, orders, heroSlides });
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
        const pricing = normalizePricing(body.price, body.discountPercent);
        const result = db_1.db
            .prepare(`INSERT INTO products
         (name, slug, sku, article, part_id, price, old_price, discount_percent, image, description, manufacturer, stock, is_available, brand_id, category_id, specs_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(body.name, body.slug ? (0, slugify_1.slugify)(body.slug) : (0, slugify_1.slugify)(body.name), body.sku, body.article ?? null, body.partId ?? null, pricing.price, pricing.oldPrice, pricing.discountPercent, body.image || null, body.description ?? null, body.manufacturer ?? null, body.stock, body.isAvailable ? 1 : 0, body.brandId, body.categoryId, body.specsJson ?? null);
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
        const pricing = normalizePricing(body.price, body.discountPercent);
        db_1.db.prepare(`UPDATE products
       SET name = ?, slug = ?, sku = ?, article = ?, part_id = ?, price = ?, old_price = ?, discount_percent = ?, image = ?, description = ?, manufacturer = ?,
           stock = ?, is_available = ?, brand_id = ?, category_id = ?, specs_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`).run(body.name, body.slug ? (0, slugify_1.slugify)(body.slug) : (0, slugify_1.slugify)(body.name), body.sku, body.article ?? null, body.partId ?? null, pricing.price, pricing.oldPrice, pricing.discountPercent, body.image || null, body.description ?? null, body.manufacturer ?? null, body.stock, body.isAvailable ? 1 : 0, body.brandId, body.categoryId, body.specsJson ?? null, id);
        res.json({ message: "Product updated" });
    }
    catch (error) {
        next(error);
    }
});
router.patch("/products/:id/discount", (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: "Invalid product id" });
        }
        const body = discountSchema.parse(req.body);
        const product = db_1.db.prepare("SELECT id, price FROM products WHERE id = ?").get(id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        const pricing = normalizePricing(product.price, body.discountPercent);
        db_1.db.prepare("UPDATE products SET old_price = ?, discount_percent = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(pricing.oldPrice, pricing.discountPercent, id);
        const updated = db_1.db.prepare("SELECT * FROM products WHERE id = ?").get(id);
        res.json(updated);
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
        const payload = normalizeBrandPayload(brandSchema.parse(req.body));
        const existing = db_1.db.prepare("SELECT id FROM brands WHERE slug = ?").get(payload.slug);
        if (existing) {
            return res.status(409).json({ message: "Brand slug already exists" });
        }
        const result = db_1.db
            .prepare("INSERT INTO brands (name, slug, logo_url, description) VALUES (?, ?, ?, ?)")
            .run(payload.name, payload.slug, payload.logoUrl, payload.description);
        const brand = db_1.db.prepare("SELECT * FROM brands WHERE id = ?").get(Number(result.lastInsertRowid));
        res.status(201).json(brand);
    }
    catch (error) {
        next(error);
    }
});
router.put("/brands/:id", (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: "Invalid brand id" });
        }
        const existingBrand = db_1.db.prepare("SELECT id FROM brands WHERE id = ?").get(id);
        if (!existingBrand) {
            return res.status(404).json({ message: "Brand not found" });
        }
        const payload = normalizeBrandPayload(brandSchema.parse(req.body));
        const slugConflict = db_1.db
            .prepare("SELECT id FROM brands WHERE slug = ? AND id <> ?")
            .get(payload.slug, id);
        if (slugConflict) {
            return res.status(409).json({ message: "Brand slug already exists" });
        }
        db_1.db.prepare(`UPDATE brands
       SET name = ?, slug = ?, logo_url = ?, description = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`).run(payload.name, payload.slug, payload.logoUrl, payload.description, id);
        const brand = db_1.db.prepare("SELECT * FROM brands WHERE id = ?").get(id);
        res.json(brand);
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
router.get("/hero-slides", (_req, res, next) => {
    try {
        const slides = db_1.db.prepare("SELECT * FROM hero_slides ORDER BY position ASC").all();
        res.json(slides);
    }
    catch (error) {
        next(error);
    }
});
router.post("/hero-slides", (req, res, next) => {
    try {
        const payload = normalizeHeroSlidePayload(heroSlideSchema.parse(req.body));
        const maxPosition = db_1.db.prepare("SELECT COALESCE(MAX(position), 0) as maxPosition FROM hero_slides").get();
        const nextPosition = maxPosition.maxPosition + 1;
        const result = db_1.db
            .prepare(`INSERT INTO hero_slides
         (position, label, image_url, title, subtitle, button_text, button_link, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(nextPosition, payload.label, payload.imageUrl, payload.title, payload.subtitle, payload.buttonText, payload.buttonLink, payload.isActive);
        const slide = db_1.db.prepare("SELECT * FROM hero_slides WHERE id = ?").get(Number(result.lastInsertRowid));
        res.status(201).json(slide);
    }
    catch (error) {
        next(error);
    }
});
router.put("/hero-slides/:id", (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: "Invalid hero slide id" });
        }
        const slide = db_1.db.prepare("SELECT * FROM hero_slides WHERE id = ?").get(id);
        if (!slide) {
            return res.status(404).json({ message: "Hero slide not found" });
        }
        const patch = heroSlideUpdateSchema.parse(req.body);
        const updatedLabel = patch.label?.trim() || slide.label;
        const updatedImage = patch.imageUrl?.trim() || slide.image_url;
        const updatedTitle = patch.title === undefined ? slide.title : patch.title.trim() ? patch.title.trim() : null;
        const updatedSubtitle = patch.subtitle === undefined ? slide.subtitle : patch.subtitle.trim() ? patch.subtitle.trim() : null;
        const updatedButtonText = patch.buttonText === undefined
            ? slide.button_text
            : patch.buttonText.trim()
                ? patch.buttonText.trim()
                : null;
        const updatedButtonLink = patch.buttonLink === undefined
            ? slide.button_link
            : patch.buttonLink.trim()
                ? patch.buttonLink.trim()
                : null;
        const updatedActive = patch.isActive === undefined ? slide.is_active : patch.isActive ? 1 : 0;
        db_1.db.prepare(`UPDATE hero_slides
       SET label = ?, image_url = ?, title = ?, subtitle = ?, button_text = ?, button_link = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`).run(updatedLabel, updatedImage, updatedTitle, updatedSubtitle, updatedButtonText, updatedButtonLink, updatedActive, id);
        const updated = db_1.db.prepare("SELECT * FROM hero_slides WHERE id = ?").get(id);
        res.json(updated);
    }
    catch (error) {
        next(error);
    }
});
router.delete("/hero-slides/:id", (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: "Invalid hero slide id" });
        }
        const tx = db_1.db.transaction((slideId) => {
            const existing = db_1.db.prepare("SELECT id FROM hero_slides WHERE id = ?").get(slideId);
            if (!existing)
                return false;
            db_1.db.prepare("DELETE FROM hero_slides WHERE id = ?").run(slideId);
            compactHeroSlidePositions();
            return true;
        });
        const deleted = tx(id);
        if (!deleted) {
            return res.status(404).json({ message: "Hero slide not found" });
        }
        res.json({ message: "Hero slide deleted" });
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

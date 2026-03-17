"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const db_1 = require("../lib/db");
const slugify_1 = require("../utils/slugify");
const router = (0, express_1.Router)();
const ORDER_STATUS = ["PENDING", "PROCESSING", "SHIPPED", "COMPLETED", "CANCELED"];
const parsePositiveId = (raw) => {
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
};
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
    isActive: payload.isActive,
});
const compactHeroSlidePositions = async (client) => {
    const slides = await (0, db_1.query)("SELECT id FROM hero_slides ORDER BY position ASC", [], client);
    for (const [index, slide] of slides.entries()) {
        await (0, db_1.query)("UPDATE hero_slides SET position = $1 WHERE id = $2", [1000 + index, slide.id], client);
    }
    for (const [index, slide] of slides.entries()) {
        await (0, db_1.query)("UPDATE hero_slides SET position = $1 WHERE id = $2", [index + 1, slide.id], client);
    }
};
router.get("/dashboard", async (_req, res, next) => {
    try {
        const users = await (0, db_1.queryOne)("SELECT COUNT(*) as c FROM users");
        const products = await (0, db_1.queryOne)("SELECT COUNT(*) as c FROM products");
        const brands = await (0, db_1.queryOne)("SELECT COUNT(*) as c FROM brands");
        const categories = await (0, db_1.queryOne)("SELECT COUNT(*) as c FROM categories");
        const orders = await (0, db_1.queryOne)("SELECT COUNT(*) as c FROM orders");
        const heroSlides = await (0, db_1.queryOne)("SELECT COUNT(*) as c FROM hero_slides");
        res.json({
            users: Number(users?.c ?? 0),
            products: Number(products?.c ?? 0),
            brands: Number(brands?.c ?? 0),
            categories: Number(categories?.c ?? 0),
            orders: Number(orders?.c ?? 0),
            heroSlides: Number(heroSlides?.c ?? 0),
        });
    }
    catch (error) {
        next(error);
    }
});
router.get("/products", async (_req, res, next) => {
    try {
        const items = await (0, db_1.query)(`SELECT p.*,
              CASE WHEN p.is_available THEN 1 ELSE 0 END as is_available,
              b.name as "brandName",
              c.name as "categoryName"
       FROM products p
       JOIN brands b ON b.id = p.brand_id
       JOIN categories c ON c.id = p.category_id
       ORDER BY p.created_at DESC`);
        res.json(items);
    }
    catch (error) {
        next(error);
    }
});
router.post("/products", async (req, res, next) => {
    try {
        const body = productSchema.parse(req.body);
        const pricing = normalizePricing(body.price, body.discountPercent);
        const created = await (0, db_1.queryOne)(`INSERT INTO products
       (name, slug, sku, article, part_id, price, old_price, discount_percent, image, description, manufacturer, stock, is_available, brand_id, category_id, specs_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING id`, [
            body.name,
            body.slug ? (0, slugify_1.slugify)(body.slug) : (0, slugify_1.slugify)(body.name),
            body.sku,
            body.article ?? null,
            body.partId ?? null,
            pricing.price,
            pricing.oldPrice,
            pricing.discountPercent,
            body.image || null,
            body.description ?? null,
            body.manufacturer ?? null,
            body.stock,
            body.isAvailable,
            body.brandId,
            body.categoryId,
            body.specsJson ?? null,
        ]);
        if (!created) {
            throw new Error("Could not create product");
        }
        res.status(201).json({ id: created.id });
    }
    catch (error) {
        next(error);
    }
});
router.put("/products/:id", async (req, res, next) => {
    try {
        const id = parsePositiveId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Invalid product id" });
        }
        const body = productSchema.parse(req.body);
        const pricing = normalizePricing(body.price, body.discountPercent);
        await (0, db_1.query)(`UPDATE products
       SET name = $1, slug = $2, sku = $3, article = $4, part_id = $5, price = $6, old_price = $7, discount_percent = $8,
           image = $9, description = $10, manufacturer = $11, stock = $12, is_available = $13, brand_id = $14, category_id = $15,
           specs_json = $16, updated_at = CURRENT_TIMESTAMP
       WHERE id = $17`, [
            body.name,
            body.slug ? (0, slugify_1.slugify)(body.slug) : (0, slugify_1.slugify)(body.name),
            body.sku,
            body.article ?? null,
            body.partId ?? null,
            pricing.price,
            pricing.oldPrice,
            pricing.discountPercent,
            body.image || null,
            body.description ?? null,
            body.manufacturer ?? null,
            body.stock,
            body.isAvailable,
            body.brandId,
            body.categoryId,
            body.specsJson ?? null,
            id,
        ]);
        res.json({ message: "Product updated" });
    }
    catch (error) {
        next(error);
    }
});
router.patch("/products/:id/discount", async (req, res, next) => {
    try {
        const id = parsePositiveId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Invalid product id" });
        }
        const body = discountSchema.parse(req.body);
        const product = await (0, db_1.queryOne)("SELECT id, price FROM products WHERE id = $1", [id]);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        const pricing = normalizePricing(product.price, body.discountPercent);
        await (0, db_1.query)("UPDATE products SET old_price = $1, discount_percent = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3", [pricing.oldPrice, pricing.discountPercent, id]);
        const updated = await (0, db_1.queryOne)("SELECT p.*, CASE WHEN p.is_available THEN 1 ELSE 0 END as is_available FROM products p WHERE id = $1", [id]);
        res.json(updated);
    }
    catch (error) {
        next(error);
    }
});
router.delete("/products/:id", async (req, res, next) => {
    try {
        const id = parsePositiveId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Invalid product id" });
        }
        await (0, db_1.query)("DELETE FROM products WHERE id = $1", [id]);
        res.json({ message: "Product deleted" });
    }
    catch (error) {
        next(error);
    }
});
router.get("/brands", async (_req, res, next) => {
    try {
        res.json(await (0, db_1.query)("SELECT * FROM brands ORDER BY name ASC"));
    }
    catch (error) {
        next(error);
    }
});
router.post("/brands", async (req, res, next) => {
    try {
        const payload = normalizeBrandPayload(brandSchema.parse(req.body));
        const existing = await (0, db_1.queryOne)("SELECT id FROM brands WHERE slug = $1", [payload.slug]);
        if (existing) {
            return res.status(409).json({ message: "Brand slug already exists" });
        }
        const created = await (0, db_1.queryOne)("INSERT INTO brands (name, slug, logo_url, description) VALUES ($1, $2, $3, $4) RETURNING id", [payload.name, payload.slug, payload.logoUrl, payload.description]);
        if (!created) {
            throw new Error("Could not create brand");
        }
        const brand = await (0, db_1.queryOne)("SELECT * FROM brands WHERE id = $1", [created.id]);
        res.status(201).json(brand);
    }
    catch (error) {
        next(error);
    }
});
router.put("/brands/:id", async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: "Invalid brand id" });
        }
        const existingBrand = await (0, db_1.queryOne)("SELECT id FROM brands WHERE id = $1", [id]);
        if (!existingBrand) {
            return res.status(404).json({ message: "Brand not found" });
        }
        const payload = normalizeBrandPayload(brandSchema.parse(req.body));
        const slugConflict = await (0, db_1.queryOne)("SELECT id FROM brands WHERE slug = $1 AND id <> $2", [payload.slug, id]);
        if (slugConflict) {
            return res.status(409).json({ message: "Brand slug already exists" });
        }
        await (0, db_1.query)(`UPDATE brands
       SET name = $1, slug = $2, logo_url = $3, description = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`, [payload.name, payload.slug, payload.logoUrl, payload.description, id]);
        const brand = await (0, db_1.queryOne)("SELECT * FROM brands WHERE id = $1", [id]);
        res.json(brand);
    }
    catch (error) {
        next(error);
    }
});
router.delete("/brands/:id", async (req, res, next) => {
    try {
        await (0, db_1.query)("DELETE FROM brands WHERE id = $1", [Number(req.params.id)]);
        res.json({ message: "Brand deleted" });
    }
    catch (error) {
        next(error);
    }
});
router.get("/categories", async (_req, res, next) => {
    try {
        res.json(await (0, db_1.query)("SELECT * FROM categories ORDER BY name ASC"));
    }
    catch (error) {
        next(error);
    }
});
router.post("/categories", async (req, res, next) => {
    try {
        const body = categorySchema.parse(req.body);
        const created = await (0, db_1.queryOne)("INSERT INTO categories (name, slug, description) VALUES ($1, $2, $3) RETURNING id", [body.name, body.slug ? (0, slugify_1.slugify)(body.slug) : (0, slugify_1.slugify)(body.name), body.description ?? null]);
        if (!created) {
            throw new Error("Could not create category");
        }
        res.status(201).json({ id: created.id });
    }
    catch (error) {
        next(error);
    }
});
router.put("/categories/:id", async (req, res, next) => {
    try {
        const id = parsePositiveId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Invalid category id" });
        }
        const body = categorySchema.parse(req.body);
        await (0, db_1.query)(`UPDATE categories
       SET name = $1, slug = $2, description = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`, [body.name, body.slug ? (0, slugify_1.slugify)(body.slug) : (0, slugify_1.slugify)(body.name), body.description ?? null, id]);
        res.json({ message: "Category updated" });
    }
    catch (error) {
        next(error);
    }
});
router.delete("/categories/:id", async (req, res, next) => {
    try {
        const id = parsePositiveId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Invalid category id" });
        }
        await (0, db_1.query)("DELETE FROM categories WHERE id = $1", [id]);
        res.json({ message: "Category deleted" });
    }
    catch (error) {
        next(error);
    }
});
router.get("/hero-slides", async (_req, res, next) => {
    try {
        const slides = await (0, db_1.query)(`SELECT id, position, label, image_url, title, subtitle, button_text, button_link,
              CASE WHEN is_active THEN 1 ELSE 0 END as is_active,
              created_at, updated_at
       FROM hero_slides
       ORDER BY position ASC`);
        res.json(slides);
    }
    catch (error) {
        next(error);
    }
});
router.post("/hero-slides", async (req, res, next) => {
    try {
        const payload = normalizeHeroSlidePayload(heroSlideSchema.parse(req.body));
        const maxPosition = await (0, db_1.queryOne)('SELECT COALESCE(MAX(position), 0) as "maxPosition" FROM hero_slides');
        const nextPosition = (maxPosition?.maxPosition ?? 0) + 1;
        const created = await (0, db_1.queryOne)(`INSERT INTO hero_slides
       (position, label, image_url, title, subtitle, button_text, button_link, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`, [
            nextPosition,
            payload.label,
            payload.imageUrl,
            payload.title,
            payload.subtitle,
            payload.buttonText,
            payload.buttonLink,
            payload.isActive,
        ]);
        if (!created) {
            throw new Error("Could not create hero slide");
        }
        const slide = await (0, db_1.queryOne)(`SELECT id, position, label, image_url, title, subtitle, button_text, button_link,
              CASE WHEN is_active THEN 1 ELSE 0 END as is_active,
              created_at, updated_at
       FROM hero_slides
       WHERE id = $1`, [created.id]);
        res.status(201).json(slide);
    }
    catch (error) {
        next(error);
    }
});
router.put("/hero-slides/:id", async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: "Invalid hero slide id" });
        }
        const slide = await (0, db_1.queryOne)("SELECT * FROM hero_slides WHERE id = $1", [id]);
        if (!slide) {
            return res.status(404).json({ message: "Hero slide not found" });
        }
        const patch = heroSlideUpdateSchema.parse(req.body);
        const updatedLabel = patch.label?.trim() || slide.label;
        const updatedImage = patch.imageUrl?.trim() || slide.image_url;
        const updatedTitle = patch.title === undefined ? slide.title : patch.title.trim() ? patch.title.trim() : null;
        const updatedSubtitle = patch.subtitle === undefined ? slide.subtitle : patch.subtitle.trim() ? patch.subtitle.trim() : null;
        const updatedButtonText = patch.buttonText === undefined ? slide.button_text : patch.buttonText.trim() ? patch.buttonText.trim() : null;
        const updatedButtonLink = patch.buttonLink === undefined ? slide.button_link : patch.buttonLink.trim() ? patch.buttonLink.trim() : null;
        const updatedActive = patch.isActive === undefined ? slide.is_active : patch.isActive;
        await (0, db_1.query)(`UPDATE hero_slides
       SET label = $1, image_url = $2, title = $3, subtitle = $4, button_text = $5, button_link = $6, is_active = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8`, [
            updatedLabel,
            updatedImage,
            updatedTitle,
            updatedSubtitle,
            updatedButtonText,
            updatedButtonLink,
            updatedActive,
            id,
        ]);
        const updated = await (0, db_1.queryOne)(`SELECT id, position, label, image_url, title, subtitle, button_text, button_link,
              CASE WHEN is_active THEN 1 ELSE 0 END as is_active,
              created_at, updated_at
       FROM hero_slides
       WHERE id = $1`, [id]);
        res.json(updated);
    }
    catch (error) {
        next(error);
    }
});
router.delete("/hero-slides/:id", async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: "Invalid hero slide id" });
        }
        const deleted = await (0, db_1.withTransaction)(async (client) => {
            const existing = await (0, db_1.queryOne)("SELECT id FROM hero_slides WHERE id = $1", [id], client);
            if (!existing)
                return false;
            await (0, db_1.query)("DELETE FROM hero_slides WHERE id = $1", [id], client);
            await compactHeroSlidePositions(client);
            return true;
        });
        if (!deleted) {
            return res.status(404).json({ message: "Hero slide not found" });
        }
        res.json({ message: "Hero slide deleted" });
    }
    catch (error) {
        next(error);
    }
});
router.get("/orders", async (_req, res, next) => {
    try {
        const orders = await (0, db_1.query)(`SELECT o.*, u.email as "userEmail", u.name as "userName"
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC`);
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
router.patch("/orders/:id/status", async (req, res, next) => {
    try {
        const statusSchema = zod_1.z.object({ status: zod_1.z.enum(ORDER_STATUS) });
        const { status } = statusSchema.parse(req.body);
        const id = parsePositiveId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Invalid order id" });
        }
        await (0, db_1.query)("UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [status, id]);
        const order = await (0, db_1.queryOne)("SELECT * FROM orders WHERE id = $1", [id]);
        res.json(order);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;

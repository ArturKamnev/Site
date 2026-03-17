"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = require("../lib/db");
const slugify_1 = require("../utils/slugify");
const brandNames = [
    "Airtech",
    "ANDAГ‡",
    "AYD",
    "AYDINSAN",
    "AYFAR",
    "BEЕћER",
    "BF Germany",
    "BPW",
    "Cojali",
    "CORTECO",
    "DAYCO",
    "Elring",
    "Euroricambi",
    "FAG",
    "FAN MARKET",
    "febi bilstein",
    "FOMAR FRICTION",
    "FSS",
    "HYBSZ",
    "KAWE",
    "K (Original 2001)",
    "KOLBENSCHMIDT",
    "KURTSAN",
    "LASO",
    "LEMA",
    "LEMFГ–RDER",
    "LuK",
    "MAHLE",
    "MARSHALL",
    "MERITOR",
    "MONROE",
    "MPM",
    "NRF",
    "ONYARBI",
    "ProVia",
    "REN-PAR",
    "SACHS",
    "SAF-Holland",
    "SE-M",
    "SOYLU",
    "VADEN",
    "Valeo",
    "VIGNAL",
    "WABCO",
    "Webasto",
    "WOLF OIL",
    "ZF",
];
const categoryNames = [
    "РўРѕСЂРјРѕР·РЅР°СЏ СЃРёСЃС‚РµРјР°",
    "РџРѕРґРІРµСЃРєР°",
    "Р”РІРёРіР°С‚РµР»СЊ",
    "Р¤РёР»СЊС‚СЂС‹",
    "Р­Р»РµРєС‚СЂРёРєР°",
    "РЎС†РµРїР»РµРЅРёРµ Рё С‚СЂР°РЅСЃРјРёСЃСЃРёСЏ",
    "РћС…Р»Р°Р¶РґРµРЅРёРµ",
    "РљСѓР·РѕРІ Рё РѕРїС‚РёРєР°",
];
const run = async () => {
    await (0, db_1.initDb)();
    await (0, db_1.withTransaction)(async (client) => {
        await (0, db_1.query)(`TRUNCATE TABLE
         order_items,
         orders,
         favorites,
         hero_slides,
         cart_items,
         carts,
         product_images,
         products,
         categories,
         brands,
         users,
         roles
       RESTART IDENTITY CASCADE`, [], client);
        await (0, db_1.query)("INSERT INTO roles (name) VALUES ($1), ($2), ($3)", ["user", "admin", "employee"], client);
        const roles = await (0, db_1.query)("SELECT id, name FROM roles", [], client);
        const getRoleId = (name) => roles.find((role) => role.name === name).id;
        await (0, db_1.query)("INSERT INTO users (name, email, password_hash, role_id) VALUES ($1, $2, $3, $4)", ["Main Admin", "admin@parts.local", await bcryptjs_1.default.hash("admin1234", 10), getRoleId("admin")], client);
        await (0, db_1.query)("INSERT INTO users (name, email, password_hash, role_id) VALUES ($1, $2, $3, $4)", ["Shop Employee", "employee@parts.local", await bcryptjs_1.default.hash("employee1234", 10), getRoleId("employee")], client);
        await (0, db_1.query)("INSERT INTO users (name, email, password_hash, role_id) VALUES ($1, $2, $3, $4)", ["Demo User", "user@parts.local", await bcryptjs_1.default.hash("user12345", 10), getRoleId("user")], client);
        for (const name of brandNames) {
            await (0, db_1.query)("INSERT INTO brands (name, slug, logo_url, description) VALUES ($1, $2, $3, $4)", [
                name,
                (0, slugify_1.slugify)(name),
                `https://dummyimage.com/280x120/0f172a/ffffff&text=${encodeURIComponent(name)}`,
                `РћСЂРёРіРёРЅР°Р»СЊРЅС‹Рµ Рё РїСЂРѕРІРµСЂРµРЅРЅС‹Рµ Р·Р°РїС‡Р°СЃС‚Рё Р±СЂРµРЅРґР° ${name} РґР»СЏ РіСЂСѓР·РѕРІРѕРіРѕ С‚СЂР°РЅСЃРїРѕСЂС‚Р°.`,
            ], client);
        }
        for (const category of categoryNames) {
            await (0, db_1.query)("INSERT INTO categories (name, slug, description) VALUES ($1, $2, $3)", [category, (0, slugify_1.slugify)(category), `РљР°С‚РµРіРѕСЂРёСЏ: ${category}`], client);
        }
        await (0, db_1.query)(`INSERT INTO hero_slides
       (position, label, image_url, title, subtitle, button_text, button_link, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
            1,
            "Top offer",
            "https://dummyimage.com/1280x420/dbeafe/0b2f62&text=Top+Offer",
            "Suspension and brake discounts",
            "OEM-compatible parts for commercial transport.",
            "Open catalog",
            "/brands",
            true,
        ], client);
        await (0, db_1.query)(`INSERT INTO hero_slides
       (position, label, image_url, title, subtitle, button_text, button_link, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
            2,
            "Fleet B2B",
            "https://dummyimage.com/1280x420/e0f2fe/0b2f62&text=Fleet+B2B",
            "Dedicated pricing for service fleets",
            "Bulk ordering and transparent stock visibility.",
            "Go to profile",
            "/profile",
            true,
        ], client);
        await (0, db_1.query)(`INSERT INTO hero_slides
       (position, label, image_url, title, subtitle, button_text, button_link, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
            3,
            "New arrivals",
            "https://dummyimage.com/1280x420/eff6ff/0b2f62&text=New+Arrivals",
            null,
            null,
            null,
            null,
            true,
        ], client);
        const brands = await (0, db_1.query)("SELECT id, name FROM brands ORDER BY id ASC", [], client);
        const categories = await (0, db_1.query)("SELECT id, name FROM categories ORDER BY id ASC", [], client);
        for (let idx = 0; idx < 24; idx += 1) {
            const brand = brands[idx % brands.length];
            const category = categories[idx % categories.length];
            const model = idx + 1000;
            const name = `${brand.name} ${category.name} ${model}`;
            const slug = (0, slugify_1.slugify)(name);
            const price = Number((90 + (idx % 9) * 25 + idx * 1.75).toFixed(2));
            const stock = (idx * 3) % 40;
            const image = `https://dummyimage.com/800x600/e2e8f0/0f172a&text=${encodeURIComponent(brand.name + " " + model)}`;
            const created = await (0, db_1.queryOne)(`INSERT INTO products
         (name, slug, sku, article, part_id, price, image, description, manufacturer, stock, is_available, brand_id, category_id, specs_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id`, [
                name,
                slug,
                `${(0, slugify_1.slugify)(brand.name).toUpperCase()}-${model}`,
                `ART-${model}`,
                `PID-${model}`,
                price,
                image,
                `Р”РµС‚Р°Р»СЊ ${name}. РџРѕРґС…РѕРґРёС‚ РґР»СЏ РєРѕРјРјРµСЂС‡РµСЃРєРѕРіРѕ Рё РіСЂСѓР·РѕРІРѕРіРѕ С‚СЂР°РЅСЃРїРѕСЂС‚Р°.`,
                brand.name,
                stock,
                stock > 0,
                brand.id,
                category.id,
                JSON.stringify({
                    weightKg: Number((2 + idx * 0.1).toFixed(1)),
                    warrantyMonths: 12,
                    country: "EU/Turkey",
                }),
            ], client);
            if (!created) {
                continue;
            }
            await (0, db_1.query)("INSERT INTO product_images (product_id, url, alt, sort_order) VALUES ($1, $2, $3, $4)", [created.id, image, name, 0], client);
            await (0, db_1.query)("INSERT INTO product_images (product_id, url, alt, sort_order) VALUES ($1, $2, $3, $4)", [
                created.id,
                `https://dummyimage.com/800x600/cbd5e1/0f172a&text=${encodeURIComponent(name + " alt")}`,
                `${name} alt`,
                1,
            ], client);
        }
    });
    console.log("Seed completed");
};
run()
    .catch((error) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
})
    .finally(async () => {
    await (0, db_1.closeDb)();
});

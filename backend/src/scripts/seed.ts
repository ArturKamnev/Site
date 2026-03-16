import bcrypt from "bcryptjs";
import { db, initDb } from "../lib/db";
import { slugify } from "../utils/slugify";

const brandNames = [
  "Airtech",
  "ANDAÇ",
  "AYD",
  "AYDINSAN",
  "AYFAR",
  "BEŞER",
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
  "LEMFÖRDER",
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
  "Тормозная система",
  "Подвеска",
  "Двигатель",
  "Фильтры",
  "Электрика",
  "Сцепление и трансмиссия",
  "Охлаждение",
  "Кузов и оптика",
];

const run = async () => {
  initDb();

  db.exec(`
    DELETE FROM order_items;
    DELETE FROM orders;
    DELETE FROM favorites;
    DELETE FROM cart_items;
    DELETE FROM carts;
    DELETE FROM product_images;
    DELETE FROM products;
    DELETE FROM categories;
    DELETE FROM brands;
    DELETE FROM users;
    DELETE FROM roles;
  `);

  const insertRole = db.prepare("INSERT INTO roles (name) VALUES (?)");
  const insertUser = db.prepare(
    "INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)",
  );

  insertRole.run("user");
  insertRole.run("admin");
  insertRole.run("employee");

  const roles = db.prepare("SELECT id, name FROM roles").all() as Array<{ id: number; name: string }>;
  const getRoleId = (name: string) => roles.find((role) => role.name === name)!.id;

  insertUser.run("Main Admin", "admin@parts.local", await bcrypt.hash("admin1234", 10), getRoleId("admin"));
  insertUser.run(
    "Shop Employee",
    "employee@parts.local",
    await bcrypt.hash("employee1234", 10),
    getRoleId("employee"),
  );
  insertUser.run("Demo User", "user@parts.local", await bcrypt.hash("user12345", 10), getRoleId("user"));

  const insertBrand = db.prepare(
    "INSERT INTO brands (name, slug, logo_url, description) VALUES (?, ?, ?, ?)",
  );
  for (const name of brandNames) {
    insertBrand.run(
      name,
      slugify(name),
      `https://dummyimage.com/280x120/0f172a/ffffff&text=${encodeURIComponent(name)}`,
      `Оригинальные и проверенные запчасти бренда ${name} для грузового транспорта.`,
    );
  }

  const insertCategory = db.prepare(
    "INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)",
  );
  for (const category of categoryNames) {
    insertCategory.run(category, slugify(category), `Категория: ${category}`);
  }

  const brands = db.prepare("SELECT id, name FROM brands ORDER BY id ASC").all() as Array<{
    id: number;
    name: string;
  }>;
  const categories = db.prepare("SELECT id, name FROM categories ORDER BY id ASC").all() as Array<{
    id: number;
    name: string;
  }>;

  const insertProduct = db.prepare(
    `INSERT INTO products
    (name, slug, sku, article, part_id, price, image, description, manufacturer, stock, is_available, brand_id, category_id, specs_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertProductImage = db.prepare(
    "INSERT INTO product_images (product_id, url, alt, sort_order) VALUES (?, ?, ?, ?)",
  );

  for (let idx = 0; idx < 24; idx += 1) {
    const brand = brands[idx % brands.length];
    const category = categories[idx % categories.length];
    const model = idx + 1000;
    const name = `${brand.name} ${category.name} ${model}`;
    const slug = slugify(name);
    const price = Number((90 + (idx % 9) * 25 + idx * 1.75).toFixed(2));
    const stock = (idx * 3) % 40;
    const image = `https://dummyimage.com/800x600/e2e8f0/0f172a&text=${encodeURIComponent(brand.name + " " + model)}`;

    const result = insertProduct.run(
      name,
      slug,
      `${slugify(brand.name).toUpperCase()}-${model}`,
      `ART-${model}`,
      `PID-${model}`,
      price,
      image,
      `Деталь ${name}. Подходит для коммерческого и грузового транспорта.`,
      brand.name,
      stock,
      stock > 0 ? 1 : 0,
      brand.id,
      category.id,
      JSON.stringify({
        weightKg: Number((2 + idx * 0.1).toFixed(1)),
        warrantyMonths: 12,
        country: "EU/Turkey",
      }),
    );

    const productId = Number(result.lastInsertRowid);
    insertProductImage.run(productId, image, name, 0);
    insertProductImage.run(
      productId,
      `https://dummyimage.com/800x600/cbd5e1/0f172a&text=${encodeURIComponent(name + " alt")}`,
      `${name} alt`,
      1,
    );
  }

  console.log("Seed completed");
};

run();

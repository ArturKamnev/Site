import bcrypt from "bcryptjs";
import { closeDb, initDb, query, queryOne, withTransaction } from "../lib/db";
import { slugify } from "../utils/slugify";

const brandNames = [
  "Airtech",
  "ANDAC",
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
  await initDb();

  await withTransaction(async (client) => {
    await query(
      `TRUNCATE TABLE
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
       RESTART IDENTITY CASCADE`,
      [],
      client,
    );

    await query("INSERT INTO roles (name) VALUES ($1), ($2), ($3)", ["user", "admin", "employee"], client);

    const roles = await query<{ id: number; name: string }>("SELECT id, name FROM roles", [], client);
    const getRoleId = (name: string) => roles.find((role) => role.name === name)!.id;

    await query(
      "INSERT INTO users (name, email, password_hash, role_id) VALUES ($1, $2, $3, $4)",
      ["Main Admin", "admin@parts.local", await bcrypt.hash("admin1234", 10), getRoleId("admin")],
      client,
    );
    await query(
      "INSERT INTO users (name, email, password_hash, role_id) VALUES ($1, $2, $3, $4)",
      ["Shop Employee", "employee@parts.local", await bcrypt.hash("employee1234", 10), getRoleId("employee")],
      client,
    );
    await query(
      "INSERT INTO users (name, email, password_hash, role_id) VALUES ($1, $2, $3, $4)",
      ["Demo User", "user@parts.local", await bcrypt.hash("user12345", 10), getRoleId("user")],
      client,
    );

    for (const name of brandNames) {
      await query(
        "INSERT INTO brands (name, slug, logo_url, description) VALUES ($1, $2, $3, $4)",
        [
          name,
          slugify(name),
          `https://dummyimage.com/280x120/0f172a/ffffff&text=${encodeURIComponent(name)}`,
          `Оригинальные и проверенные запчасти бренда ${name} для грузового транспорта.`,
        ],
        client,
      );
    }

    for (const category of categoryNames) {
      await query(
        "INSERT INTO categories (name, slug, description) VALUES ($1, $2, $3)",
        [category, slugify(category), `Категория: ${category}`],
        client,
      );
    }

    await query(
      `INSERT INTO hero_slides
       (position, label, image_url, title, subtitle, button_text, button_link, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        1,
        "Top offer",
        "https://dummyimage.com/1280x420/dbeafe/0b2f62&text=Top+Offer",
        "Suspension and brake discounts",
        "OEM-compatible parts for commercial transport.",
        "Open catalog",
        "/brands",
        true,
      ],
      client,
    );
    await query(
      `INSERT INTO hero_slides
       (position, label, image_url, title, subtitle, button_text, button_link, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        2,
        "Fleet B2B",
        "https://dummyimage.com/1280x420/e0f2fe/0b2f62&text=Fleet+B2B",
        "Dedicated pricing for service fleets",
        "Bulk ordering and transparent stock visibility.",
        "Go to profile",
        "/profile",
        true,
      ],
      client,
    );
    await query(
      `INSERT INTO hero_slides
       (position, label, image_url, title, subtitle, button_text, button_link, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        3,
        "New arrivals",
        "https://dummyimage.com/1280x420/eff6ff/0b2f62&text=New+Arrivals",
        null,
        null,
        null,
        null,
        true,
      ],
      client,
    );

    const brands = await query<{ id: number; name: string }>(
      "SELECT id, name FROM brands ORDER BY id ASC",
      [],
      client,
    );
    const categories = await query<{ id: number; name: string }>(
      "SELECT id, name FROM categories ORDER BY id ASC",
      [],
      client,
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

      const created = await queryOne<{ id: number }>(
        `INSERT INTO products
         (name, slug, sku, article, part_id, price, image, description, manufacturer, stock, is_available, brand_id, category_id, specs_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id`,
        [
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
          stock > 0,
          brand.id,
          category.id,
          JSON.stringify({
            weightKg: Number((2 + idx * 0.1).toFixed(1)),
            warrantyMonths: 12,
            country: "EU/Turkey",
          }),
        ],
        client,
      );

      if (!created) {
        continue;
      }

      await query(
        "INSERT INTO product_images (product_id, url, alt, sort_order) VALUES ($1, $2, $3, $4)",
        [created.id, image, name, 0],
        client,
      );
      await query(
        "INSERT INTO product_images (product_id, url, alt, sort_order) VALUES ($1, $2, $3, $4)",
        [
          created.id,
          `https://dummyimage.com/800x600/cbd5e1/0f172a&text=${encodeURIComponent(name + " alt")}`,
          `${name} alt`,
          1,
        ],
        client,
      );
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
    await closeDb();
  });

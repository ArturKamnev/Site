import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../lib/api";
import type { Brand, Category, Order, Product } from "../types";

type Dashboard = { users: number; products: number; brands: number; categories: number; orders: number };

const defaultProduct = {
  name: "",
  sku: "",
  article: "",
  partId: "",
  price: 0,
  image: "",
  description: "",
  manufacturer: "",
  stock: 0,
  isAvailable: true,
  brandId: 1,
  categoryId: 1,
  specsJson: "",
};

const defaultBrandForm = {
  id: null as number | null,
  name: "",
  slug: "",
  logoUrl: "",
  description: "",
};

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const AdminPage = () => {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [productForm, setProductForm] = useState(defaultProduct);
  const [brandForm, setBrandForm] = useState(defaultBrandForm);
  const [categoryName, setCategoryName] = useState("");

  const load = async () => {
    const [d, p, b, c, o] = await Promise.all([
      api.get<Dashboard>("/admin/dashboard"),
      api.get<Product[]>("/admin/products"),
      api.get<Brand[]>("/admin/brands"),
      api.get<Category[]>("/admin/categories"),
      api.get<Order[]>("/admin/orders"),
    ]);
    setDashboard(d.data);
    setProducts(p.data);
    setBrands(b.data);
    setCategories(c.data);
    setOrders(o.data);
    if (b.data[0] && c.data[0]) {
      setProductForm((prev) => ({ ...prev, brandId: b.data[0].id, categoryId: c.data[0].id }));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createProduct = async (event: FormEvent) => {
    event.preventDefault();
    await api.post("/admin/products", productForm);
    setProductForm(defaultProduct);
    await load();
  };

  const submitBrand = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      name: brandForm.name,
      slug: brandForm.slug || undefined,
      logoUrl: brandForm.logoUrl || "",
      description: brandForm.description || "",
    };

    if (brandForm.id) {
      await api.put(`/admin/brands/${brandForm.id}`, payload);
    } else {
      await api.post("/admin/brands", payload);
    }

    setBrandForm(defaultBrandForm);
    await load();
  };

  const startBrandEdit = (brand: Brand) => {
    setBrandForm({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      logoUrl: brand.logo_url || "",
      description: brand.description || "",
    });
  };

  return (
    <section className="admin-page">
      <div className="title-block">
        <h1>Админ-панель</h1>
        <p>Управление товарами, брендами, категориями и заказами без изменения текущей бизнес-логики.</p>
      </div>

      <div className="stats-grid">
        <article className="surface stat-card">
          <span>Пользователи</span>
          <strong>{dashboard?.users ?? 0}</strong>
        </article>
        <article className="surface stat-card">
          <span>Товары</span>
          <strong>{dashboard?.products ?? 0}</strong>
        </article>
        <article className="surface stat-card">
          <span>Бренды</span>
          <strong>{dashboard?.brands ?? 0}</strong>
        </article>
        <article className="surface stat-card">
          <span>Категории</span>
          <strong>{dashboard?.categories ?? 0}</strong>
        </article>
        <article className="surface stat-card">
          <span>Заказы</span>
          <strong>{dashboard?.orders ?? 0}</strong>
        </article>
      </div>

      <h2>Добавить товар</h2>
      <form className="form surface" onSubmit={createProduct}>
        <input value={productForm.name} onChange={(e) => setProductForm((p) => ({ ...p, name: e.target.value }))} placeholder="Название" required />
        <input value={productForm.sku} onChange={(e) => setProductForm((p) => ({ ...p, sku: e.target.value }))} placeholder="SKU" required />
        <input value={productForm.article} onChange={(e) => setProductForm((p) => ({ ...p, article: e.target.value }))} placeholder="Артикул" />
        <input value={productForm.partId} onChange={(e) => setProductForm((p) => ({ ...p, partId: e.target.value }))} placeholder="Part ID" />
        <input type="number" value={productForm.price} onChange={(e) => setProductForm((p) => ({ ...p, price: Number(e.target.value) }))} placeholder="Цена" />
        <input value={productForm.image} onChange={(e) => setProductForm((p) => ({ ...p, image: e.target.value }))} placeholder="URL изображения" />
        <input value={productForm.manufacturer} onChange={(e) => setProductForm((p) => ({ ...p, manufacturer: e.target.value }))} placeholder="Производитель" />
        <input type="number" value={productForm.stock} onChange={(e) => setProductForm((p) => ({ ...p, stock: Number(e.target.value) }))} placeholder="Наличие (шт)" />
        <select value={productForm.brandId} onChange={(e) => setProductForm((p) => ({ ...p, brandId: Number(e.target.value) }))}>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
        <select value={productForm.categoryId} onChange={(e) => setProductForm((p) => ({ ...p, categoryId: Number(e.target.value) }))}>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <textarea value={productForm.description} onChange={(e) => setProductForm((p) => ({ ...p, description: e.target.value }))} placeholder="Описание" />
        <button type="submit">Создать товар</button>
      </form>

      <h2>Товары</h2>
      <div className="table-wrap surface">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Название</th>
              <th>SKU</th>
              <th>Цена</th>
              <th>Бренд</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>{product.id}</td>
                <td>{product.name}</td>
                <td>{product.sku}</td>
                <td>{money.format(product.price)}</td>
                <td>{product.brandName}</td>
                <td>
                  <button type="button" className="danger" onClick={() => api.delete(`/admin/products/${product.id}`).then(load)}>
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Бренды и категории</h2>
      <div className="two-col">
        <form className="form surface" onSubmit={submitBrand}>
          <h3>{brandForm.id ? "Редактировать бренд" : "Добавить бренд"}</h3>
          <input
            value={brandForm.name}
            onChange={(event) => setBrandForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Название бренда"
            required
          />
          <input
            value={brandForm.slug}
            onChange={(event) => setBrandForm((prev) => ({ ...prev, slug: event.target.value }))}
            placeholder="Slug (необязательно)"
          />
          <input
            value={brandForm.logoUrl}
            onChange={(event) => setBrandForm((prev) => ({ ...prev, logoUrl: event.target.value }))}
            placeholder="URL логотипа"
          />
          <textarea
            value={brandForm.description}
            onChange={(event) => setBrandForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Описание бренда"
          />
          <div className="inline-row">
            <button type="submit">{brandForm.id ? "Сохранить бренд" : "Добавить бренд"}</button>
            {brandForm.id ? (
              <button type="button" className="ghost-btn" onClick={() => setBrandForm(defaultBrandForm)}>
                Отмена
              </button>
            ) : null}
          </div>

          {brands.map((brand) => (
            <div key={brand.id} className="brand-admin-item">
              <img
                src={brand.logo_url || "https://dummyimage.com/120x50/e2e8f0/0f172a&text=Brand"}
                alt={brand.name}
              />
              <div>
                <strong>{brand.name}</strong>
                <p className="muted">{brand.description || "Описание не заполнено"}</p>
              </div>
              <div className="inline-row">
                <button type="button" className="ghost-btn" onClick={() => startBrandEdit(brand)}>
                  Изменить
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => api.delete(`/admin/brands/${brand.id}`).then(load)}
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </form>

        <form
          className="form surface"
          onSubmit={(event) => {
            event.preventDefault();
            api.post("/admin/categories", { name: categoryName }).then(() => {
              setCategoryName("");
              load();
            });
          }}
        >
          <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Новая категория" />
          <button type="submit">Добавить категорию</button>
          {categories.map((category) => (
            <div key={category.id} className="inline-row">
              <span>{category.name}</span>
              <button type="button" className="danger" onClick={() => api.delete(`/admin/categories/${category.id}`).then(load)}>
                Удалить
              </button>
            </div>
          ))}
        </form>
      </div>

      <h2>Заказы</h2>
      <div className="orders">
        {orders.map((order) => (
          <article key={order.id} className="surface order-card">
            <div className="order-head">
              <h3>#{order.id}</h3>
              <span className="meta-chip">{order.status}</span>
            </div>
            <p className="muted">
              {order.full_name} | {money.format(order.total)}
            </p>
            <select
              value={order.status}
              onChange={(event) =>
                api
                  .patch(`/admin/orders/${order.id}/status`, { status: event.target.value })
                  .then(load)
              }
            >
              <option value="PENDING">PENDING</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="SHIPPED">SHIPPED</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELED">CANCELED</option>
            </select>
          </article>
        ))}
      </div>
    </section>
  );
};

export default AdminPage;

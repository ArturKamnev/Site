import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { api } from "../lib/api";
import type { Brand, Category, HeroSlide, Order, Product } from "../types";

type Dashboard = {
  users: number;
  products: number;
  brands: number;
  categories: number;
  orders: number;
  heroSlides?: number;
};

const defaultProduct = {
  name: "",
  sku: "",
  article: "",
  partId: "",
  price: 0,
  discountPercent: 0,
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

const defaultSlideForm = {
  label: "",
  imageUrl: "",
  title: "",
  subtitle: "",
  buttonText: "",
  buttonLink: "",
  isActive: true,
};

const AdminPage = () => {
  const { t, formatMoney } = useI18n();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [productForm, setProductForm] = useState(defaultProduct);
  const [brandForm, setBrandForm] = useState(defaultBrandForm);
  const [categoryName, setCategoryName] = useState("");
  const [slideForm, setSlideForm] = useState(defaultSlideForm);
  const [discountDrafts, setDiscountDrafts] = useState<Record<number, string>>({});
  const getStatusLabel = (status: string) =>
    t(`status.${status.toLowerCase()}`) === `status.${status.toLowerCase()}`
      ? status
      : t(`status.${status.toLowerCase()}`);

  const load = async () => {
    const [d, p, b, c, o, s] = await Promise.all([
      api.get<Dashboard>("/admin/dashboard"),
      api.get<Product[]>("/admin/products"),
      api.get<Brand[]>("/admin/brands"),
      api.get<Category[]>("/admin/categories"),
      api.get<Order[]>("/admin/orders"),
      api.get<HeroSlide[]>("/admin/hero-slides"),
    ]);

    setDashboard(d.data);
    setProducts(p.data);
    setBrands(b.data);
    setCategories(c.data);
    setOrders(o.data);
    setHeroSlides(s.data);

    setDiscountDrafts(
      Object.fromEntries(
        p.data.map((item) => [item.id, String(item.discount_percent ?? 0)]),
      ),
    );

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

  const applyProductDiscount = async (productId: number, discountValue: number) => {
    await api.patch(`/admin/products/${productId}/discount`, {
      discountPercent: Math.max(0, Math.min(discountValue, 95)),
    });
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

  const submitHeroSlide = async (event: FormEvent) => {
    event.preventDefault();
    await api.post("/admin/hero-slides", slideForm);
    setSlideForm(defaultSlideForm);
    await load();
  };

  const toggleHeroSlide = async (slide: HeroSlide) => {
    await api.put(`/admin/hero-slides/${slide.id}`, {
      isActive: slide.is_active !== 1,
    });
    await load();
  };

  const deleteHeroSlide = async (id: number) => {
    await api.delete(`/admin/hero-slides/${id}`);
    await load();
  };

  return (
    <section className="admin-page">
      <div className="title-block">
        <h1>{t("admin.title")}</h1>
        <p>{t("admin.description")}</p>
      </div>

      <div className="stats-grid">
        <article className="surface stat-card">
          <span>{t("admin.users")}</span>
          <strong>{dashboard?.users ?? 0}</strong>
        </article>
        <article className="surface stat-card">
          <span>{t("admin.products")}</span>
          <strong>{dashboard?.products ?? 0}</strong>
        </article>
        <article className="surface stat-card">
          <span>{t("admin.brands")}</span>
          <strong>{dashboard?.brands ?? 0}</strong>
        </article>
        <article className="surface stat-card">
          <span>{t("admin.categories")}</span>
          <strong>{dashboard?.categories ?? 0}</strong>
        </article>
        <article className="surface stat-card">
          <span>{t("admin.slides")}</span>
          <strong>{dashboard?.heroSlides ?? heroSlides.length}</strong>
        </article>
        <article className="surface stat-card">
          <span>{t("admin.orders")}</span>
          <strong>{dashboard?.orders ?? 0}</strong>
        </article>
      </div>

      <h2>{t("admin.createProduct")}</h2>
      <form className="form surface" onSubmit={createProduct}>
        <input
          value={productForm.name}
          onChange={(event) => setProductForm((prev) => ({ ...prev, name: event.target.value }))}
          placeholder={t("admin.productName")}
          required
        />
        <input
          value={productForm.sku}
          onChange={(event) => setProductForm((prev) => ({ ...prev, sku: event.target.value }))}
          placeholder={t("common.sku")}
          required
        />
        <input
          value={productForm.article}
          onChange={(event) => setProductForm((prev) => ({ ...prev, article: event.target.value }))}
          placeholder={t("common.article")}
        />
        <input
          value={productForm.partId}
          onChange={(event) => setProductForm((prev) => ({ ...prev, partId: event.target.value }))}
          placeholder={t("productPage.partId")}
        />
        <input
          type="number"
          min={0}
          step="0.01"
          value={productForm.price}
          onChange={(event) => setProductForm((prev) => ({ ...prev, price: Number(event.target.value) }))}
          placeholder={t("admin.currentPrice")}
        />
        <input
          type="number"
          min={0}
          max={95}
          value={productForm.discountPercent}
          onChange={(event) =>
            setProductForm((prev) => ({ ...prev, discountPercent: Number(event.target.value) || 0 }))
          }
          placeholder={t("admin.discountPercent")}
        />
        <input
          value={productForm.image}
          onChange={(event) => setProductForm((prev) => ({ ...prev, image: event.target.value }))}
          placeholder={t("admin.imageUrl")}
        />
        <input
          value={productForm.manufacturer}
          onChange={(event) => setProductForm((prev) => ({ ...prev, manufacturer: event.target.value }))}
          placeholder={t("common.manufacturer")}
        />
        <input
          type="number"
          min={0}
          value={productForm.stock}
          onChange={(event) => setProductForm((prev) => ({ ...prev, stock: Number(event.target.value) }))}
          placeholder={t("admin.stock")}
        />
        <select
          value={productForm.brandId}
          onChange={(event) => setProductForm((prev) => ({ ...prev, brandId: Number(event.target.value) }))}
        >
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
        <select
          value={productForm.categoryId}
          onChange={(event) => setProductForm((prev) => ({ ...prev, categoryId: Number(event.target.value) }))}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <textarea
          value={productForm.description}
          onChange={(event) => setProductForm((prev) => ({ ...prev, description: event.target.value }))}
          placeholder={t("productPage.description")}
        />
        <button type="submit">{t("admin.createProductSubmit")}</button>
      </form>

      <h2>{t("admin.productsAndDiscounts")}</h2>
      <div className="table-wrap surface">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>{t("common.name")}</th>
              <th>{t("common.sku")}</th>
              <th>{t("common.price")}</th>
              <th>{t("admin.discount")}</th>
              <th>{t("admin.brand")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>{product.id}</td>
                <td>{product.name}</td>
                <td>{product.sku}</td>
                <td>
                  <div className="table-price-cell">
                    <strong>{formatMoney(product.price)}</strong>
                    {product.old_price ? <small>{formatMoney(product.old_price)}</small> : null}
                  </div>
                </td>
                <td>
                  <div className="inline-row">
                    <input
                      type="number"
                      min={0}
                      max={95}
                      value={discountDrafts[product.id] ?? "0"}
                      onChange={(event) =>
                        setDiscountDrafts((prev) => ({
                          ...prev,
                          [product.id]: event.target.value,
                        }))
                      }
                      className="discount-input"
                    />
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() =>
                        applyProductDiscount(product.id, Number(discountDrafts[product.id] ?? product.discount_percent ?? 0))
                      }
                    >
                      {t("admin.applyDiscount")}
                    </button>
                    <button type="button" className="ghost-btn" onClick={() => applyProductDiscount(product.id, 0)}>
                      {t("admin.removeDiscount")}
                    </button>
                  </div>
                </td>
                <td>{product.brandName}</td>
                <td>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => api.delete(`/admin/products/${product.id}`).then(load)}
                  >
                    {t("common.delete")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>{t("admin.heroSlides")}</h2>
      <div className="two-col">
        <form className="form surface" onSubmit={submitHeroSlide}>
          <h3>{t("admin.addSlide")}</h3>
          <input
            value={slideForm.label}
            onChange={(event) => setSlideForm((prev) => ({ ...prev, label: event.target.value }))}
            placeholder={t("admin.label")}
            required
          />
          <input
            value={slideForm.imageUrl}
            onChange={(event) => setSlideForm((prev) => ({ ...prev, imageUrl: event.target.value }))}
            placeholder={t("admin.imageUrl")}
            required
          />
          <input
            value={slideForm.title}
            onChange={(event) => setSlideForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder={t("admin.slideTitle")}
          />
          <textarea
            value={slideForm.subtitle}
            onChange={(event) => setSlideForm((prev) => ({ ...prev, subtitle: event.target.value }))}
            placeholder={t("admin.slideSubtitle")}
          />
          <input
            value={slideForm.buttonText}
            onChange={(event) => setSlideForm((prev) => ({ ...prev, buttonText: event.target.value }))}
            placeholder={t("admin.buttonText")}
          />
          <input
            value={slideForm.buttonLink}
            onChange={(event) => setSlideForm((prev) => ({ ...prev, buttonLink: event.target.value }))}
            placeholder={t("admin.buttonLink")}
          />
          <label className="inline-checkbox">
            <input
              type="checkbox"
              checked={slideForm.isActive}
              onChange={(event) => setSlideForm((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
            {t("common.active")}
          </label>
          <button type="submit">{t("admin.createSlide")}</button>
        </form>

        <div className="form surface">
          <h3>{t("admin.currentSlides")}</h3>
          {heroSlides.map((slide) => (
            <article key={slide.id} className="hero-slide-admin-item">
              <img src={slide.image_url} alt={slide.label} />
              <div>
                <strong>
                  #{slide.position} {slide.label}
                </strong>
                <p className="muted">{slide.title || t("admin.noTitle")}</p>
                <small>{slide.is_active ? t("common.active") : t("common.hidden")}</small>
              </div>
              <div className="inline-row">
                <button type="button" className="ghost-btn" onClick={() => toggleHeroSlide(slide)}>
                  {slide.is_active ? t("admin.hide") : t("admin.show")}
                </button>
                <button type="button" className="danger" onClick={() => deleteHeroSlide(slide.id)}>
                  {t("common.delete")}
                </button>
              </div>
            </article>
          ))}
          {!heroSlides.length ? <p className="empty-state">{t("admin.noSlides")}</p> : null}
        </div>
      </div>

      <h2>{t("admin.brandsAndCategories")}</h2>
      <div className="two-col">
        <form className="form surface" onSubmit={submitBrand}>
          <h3>{brandForm.id ? t("admin.editBrand") : t("admin.addBrand")}</h3>
          <input
            value={brandForm.name}
            onChange={(event) => setBrandForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder={t("admin.brandName")}
            required
          />
          <input
            value={brandForm.slug}
            onChange={(event) => setBrandForm((prev) => ({ ...prev, slug: event.target.value }))}
            placeholder={t("admin.slugOptional")}
          />
          <input
            value={brandForm.logoUrl}
            onChange={(event) => setBrandForm((prev) => ({ ...prev, logoUrl: event.target.value }))}
            placeholder={t("admin.imageUrl")}
          />
          <textarea
            value={brandForm.description}
            onChange={(event) => setBrandForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder={t("admin.brandDescription")}
          />
          <div className="inline-row">
            <button type="submit">{brandForm.id ? t("admin.saveBrand") : t("admin.addBrandSubmit")}</button>
            {brandForm.id ? (
              <button type="button" className="ghost-btn" onClick={() => setBrandForm(defaultBrandForm)}>
                {t("common.cancel")}
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
                <p className="muted">{brand.description || t("admin.noBrandDescription")}</p>
              </div>
              <div className="inline-row">
                <button type="button" className="ghost-btn" onClick={() => startBrandEdit(brand)}>
                  {t("common.edit")}
                </button>
                <button type="button" className="danger" onClick={() => api.delete(`/admin/brands/${brand.id}`).then(load)}>
                  {t("common.delete")}
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
          <h3>{t("admin.addCategory")}</h3>
          <input
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
            placeholder={t("admin.categoryName")}
          />
          <button type="submit">{t("admin.addCategorySubmit")}</button>
          {categories.map((category) => (
            <div key={category.id} className="inline-row">
              <span>{category.name}</span>
              <button type="button" className="danger" onClick={() => api.delete(`/admin/categories/${category.id}`).then(load)}>
                {t("common.delete")}
              </button>
            </div>
          ))}
        </form>
      </div>

      <h2>{t("admin.orders")}</h2>
      <div className="orders">
        {orders.map((order) => (
          <article key={order.id} className="surface order-card">
            <div className="order-head">
              <h3>#{order.id}</h3>
              <span className="meta-chip">{getStatusLabel(order.status)}</span>
            </div>
            <p className="muted">
              {order.full_name} | {formatMoney(order.total)}
            </p>
            <select
              value={order.status}
              onChange={(event) =>
                api
                  .patch(`/admin/orders/${order.id}/status`, { status: event.target.value })
                  .then(load)
              }
            >
              <option value="PENDING">{getStatusLabel("PENDING")}</option>
              <option value="PROCESSING">{getStatusLabel("PROCESSING")}</option>
              <option value="SHIPPED">{getStatusLabel("SHIPPED")}</option>
              <option value="COMPLETED">{getStatusLabel("COMPLETED")}</option>
              <option value="CANCELED">{getStatusLabel("CANCELED")}</option>
            </select>
          </article>
        ))}
      </div>
    </section>
  );
};

export default AdminPage;

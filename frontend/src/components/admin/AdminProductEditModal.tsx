import { useState } from "react";
import type { FormEvent } from "react";

import { useI18n } from "../../i18n/I18nProvider";
import { api } from "../../lib/api";
import type { AdminOption, Product } from "../../types";
import { getApiErrorMessage, type ProductFormState } from "./adminHelpers";

type Props = {
  product: Product;
  brands: AdminOption[];
  categories: AdminOption[];
  onClose: () => void;
  onSaved: (product: Product) => void | Promise<void>;
};

const productToForm = (product: Product): ProductFormState => ({
  name: product.name,
  sku: product.sku,
  article: product.article ?? "",
  partId: product.part_id ?? "",
  price: Number(product.price ?? 0),
  discountPercent: Number(product.discount_percent ?? 0),
  image: product.image ?? "",
  description: product.description ?? "",
  manufacturer: product.manufacturer ?? "",
  stock: Number(product.stock ?? 0),
  isAvailable: product.is_available === 1,
  brandId: product.brand_id ?? 0,
  categoryId: product.category_id ?? 0,
  specsJson: product.specs_json ?? "",
});

const AdminProductEditModal = ({ product, brands, categories, onClose, onSaved }: Props) => {
  const { t } = useI18n();
  const [initialForm] = useState<ProductFormState>(() => productToForm(product));
  const [form, setForm] = useState<ProductFormState>(initialForm);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const hasUnsavedChanges = JSON.stringify(form) !== JSON.stringify(initialForm);

  const update = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveProduct = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      const response = await api.put<Product>(`/admin/products/${product.id}`, form);
      await onSaved(response.data);
    } catch (saveError) {
      setError(getApiErrorMessage(saveError, t("admin.productSaveFailed")));
    } finally {
      setIsSaving(false);
    }
  };

  const closeEditor = () => {
    if (hasUnsavedChanges && !window.confirm(t("admin.unsavedChanges"))) {
      return;
    }

    onClose();
  };

  return (
    <div className="admin-modal-backdrop" role="presentation">
      <div className="surface admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-product-edit-title">
        <div className="admin-section-head">
          <div>
            <h2 id="admin-product-edit-title">{t("admin.productEditTitle")}</h2>
            <p className="muted">{t("admin.productEditDescription")}</p>
          </div>
          <button type="button" className="ghost-btn" onClick={closeEditor} aria-label={t("admin.closeEditor")}>
            {t("admin.closeEditor")}
          </button>
        </div>
        <form className="form admin-product-form" onSubmit={saveProduct}>
          <fieldset className="admin-form-panel">
            <legend>{t("admin.productDetails")}</legend>
            <label>
              <span>{t("admin.productName")}</span>
              <input value={form.name} onChange={(event) => update("name", event.target.value)} required />
            </label>
            <label>
              <span>{t("common.sku")}</span>
              <input value={form.sku} onChange={(event) => update("sku", event.target.value)} required />
            </label>
            <label>
              <span>{t("common.article")}</span>
              <input value={form.article} onChange={(event) => update("article", event.target.value)} />
            </label>
            <label>
              <span>{t("productPage.partId")}</span>
              <input value={form.partId} onChange={(event) => update("partId", event.target.value)} />
            </label>
            <label>
              <span>{t("common.manufacturer")}</span>
              <input value={form.manufacturer} onChange={(event) => update("manufacturer", event.target.value)} />
            </label>
            <label>
              <span>{t("productPage.description")}</span>
              <textarea value={form.description} onChange={(event) => update("description", event.target.value)} />
            </label>
          </fieldset>

          <fieldset className="admin-form-panel">
            <legend>{t("admin.productPricing")}</legend>
            <label>
              <span>{t("admin.currentPrice")}</span>
              <input type="number" min={0} step="0.01" value={form.price} onChange={(event) => update("price", Number(event.target.value))} />
            </label>
            <label>
              <span>{t("admin.discountPercent")}</span>
              <input type="number" min={0} max={95} value={form.discountPercent} onChange={(event) => update("discountPercent", Number(event.target.value) || 0)} />
            </label>
          </fieldset>

          <fieldset className="admin-form-panel">
            <legend>{t("admin.productMedia")}</legend>
            <label>
              <span>{t("admin.imageUrl")}</span>
              <input value={form.image} onChange={(event) => update("image", event.target.value)} />
            </label>
            <label>
              <span>{t("admin.specsJson")}</span>
              <textarea value={form.specsJson} onChange={(event) => update("specsJson", event.target.value)} />
            </label>
          </fieldset>

          <fieldset className="admin-form-panel">
            <legend>{t("admin.productInventory")}</legend>
            <label>
              <span>{t("admin.stock")}</span>
              <input type="number" min={0} value={form.stock} onChange={(event) => update("stock", Number(event.target.value))} />
            </label>
            <label>
              <span>{t("admin.brand")}</span>
              <select value={form.brandId} onChange={(event) => update("brandId", Number(event.target.value))} required>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("common.category")}</span>
              <select value={form.categoryId} onChange={(event) => update("categoryId", Number(event.target.value))} required>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-checkbox admin-checkbox">
              <input type="checkbox" checked={form.isAvailable} onChange={(event) => update("isAvailable", event.target.checked)} />
              {t("admin.isAvailable")}
            </label>
          </fieldset>
          {error ? <p className="error">{error}</p> : null}
          <div className="inline-row admin-form-actions">
            <button type="submit" disabled={isSaving || !brands.length || !categories.length}>
              {isSaving ? t("admin.saving") : t("admin.saveProduct")}
            </button>
            <button type="button" className="ghost-btn" onClick={() => setForm(initialForm)} disabled={!hasUnsavedChanges || isSaving}>
              {t("admin.resetForm")}
            </button>
            <button type="button" className="ghost-btn" onClick={closeEditor}>
              {t("common.cancel")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminProductEditModal;

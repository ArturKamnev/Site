import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { useI18n } from "../../i18n/I18nProvider";
import { api } from "../../lib/api";
import type { AdminOption } from "../../types";
import { createDefaultProductForm, getApiErrorMessage, type ProductFormState } from "./adminHelpers";

type Props = {
  brands: AdminOption[];
  categories: AdminOption[];
  onCreated: () => void;
};

const AdminProductCreateForm = ({ brands, categories, onCreated }: Props) => {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<ProductFormState>(createDefaultProductForm(brands[0]?.id, categories[0]?.id));
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      brandId: prev.brandId || brands[0]?.id || 0,
      categoryId: prev.categoryId || categories[0]?.id || 0,
    }));
  }, [brands, categories]);

  const update = <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const createProduct = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      await api.post("/admin/products", form);
      setForm(createDefaultProductForm(brands[0]?.id, categories[0]?.id));
      setIsOpen(false);
      onCreated();
    } catch (createError) {
      setError(getApiErrorMessage(createError, t("errors.generic")));
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setForm(createDefaultProductForm(brands[0]?.id, categories[0]?.id));
    setError("");
  };

  return (
    <div className="surface admin-collapsible">
      <div className="admin-section-head">
        <div>
          <h2>{t("admin.createProduct")}</h2>
          <p className="muted">{t("admin.createProductHint")}</p>
        </div>
        <button type="button" className="ghost-btn" onClick={() => setIsOpen((value) => !value)}>
          {isOpen ? t("admin.hideSection") : t("admin.showSection")}
        </button>
      </div>

      {isOpen ? (
        <form className="form admin-product-form" onSubmit={createProduct}>
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
              {isSaving ? t("admin.saving") : t("admin.createProductSubmit")}
            </button>
            <button type="button" className="ghost-btn" onClick={resetForm} disabled={isSaving}>
              {t("admin.resetForm")}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
};

export default AdminProductCreateForm;

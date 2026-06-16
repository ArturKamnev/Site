import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { isAxiosError } from "axios";

import { useI18n } from "../../i18n/I18nProvider";
import { api } from "../../lib/api";
import type { AdminBrandsResponse, Brand } from "../../types";
import { defaultPagination, getApiErrorMessage } from "./adminHelpers";

type DirectorySort = "name_asc" | "name_desc" | "newest" | "oldest";

type BrandForm = {
  id: number | null;
  name: string;
  slug: string;
  logoUrl: string;
  description: string;
};

const defaultBrandForm: BrandForm = {
  id: null,
  name: "",
  slug: "",
  logoUrl: "",
  description: "",
};

type Props = {
  onChanged: () => void;
};

const AdminBrandsManager = ({ onChanged }: Props) => {
  const { t } = useI18n();
  const [items, setItems] = useState<Brand[]>([]);
  const [pagination, setPagination] = useState(defaultPagination);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<DirectorySort>("name_asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [form, setForm] = useState<BrandForm>(defaultBrandForm);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadBrands = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await api.get<AdminBrandsResponse>("/admin/brands", {
        params: { page, pageSize, search: debouncedSearch || undefined, sort },
      });
      setItems(response.data.items);
      setPagination(response.data.pagination);
    } catch (loadError) {
      setItems([]);
      setPagination(defaultPagination);
      setError(getApiErrorMessage(loadError, t("errors.generic")));
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, page, pageSize, sort, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  const submitBrand = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSaving(true);

    const payload = {
      name: form.name,
      slug: form.slug || undefined,
      logoUrl: form.logoUrl || "",
      description: form.description || "",
    };

    try {
      if (form.id) {
        await api.put(`/admin/brands/${form.id}`, payload);
      } else {
        await api.post("/admin/brands", payload);
      }
      setForm(defaultBrandForm);
      setNotice(t("admin.brandSaved"));
      onChanged();
      await loadBrands();
    } catch (saveError) {
      setError(getApiErrorMessage(saveError, t("admin.brandSaveFailed")));
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (brand: Brand) => {
    setForm({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      logoUrl: brand.logo_url || "",
      description: brand.description || "",
    });
  };

  const deleteBrand = async (brand: Brand) => {
    if (!window.confirm(`${t("admin.confirmDelete")}\n\n${t("admin.deleteWarning")}`)) {
      return;
    }

    setError("");
    setNotice("");
    try {
      await api.delete(`/admin/brands/${brand.id}`);
      onChanged();
      if (items.length === 1 && page > 1) {
        setPage((current) => current - 1);
        return;
      }
      await loadBrands();
    } catch (deleteError) {
      if (isAxiosError<{ message?: string; productsCount?: number }>(deleteError) && deleteError.response?.status === 409) {
        setError(t("admin.deleteBlocked", { count: deleteError.response.data.productsCount ?? 0 }));
        return;
      }
      setError(getApiErrorMessage(deleteError, t("admin.deleteFailed")));
    }
  };

  return (
    <section className="admin-section">
      <div className="two-col">
        <form className="form surface" onSubmit={submitBrand}>
          <div>
            <h2>{form.id ? t("admin.updateBrand") : t("admin.createBrand")}</h2>
            <p className="muted">{t("admin.brandsDescription")}</p>
          </div>
          <label>
            <span>{t("admin.brandName")}</span>
            <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
          </label>
          <label>
            <span>{t("admin.slugOptional")}</span>
            <input value={form.slug} onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))} />
          </label>
          <label>
            <span>{t("admin.imageUrl")}</span>
            <input value={form.logoUrl} onChange={(event) => setForm((prev) => ({ ...prev, logoUrl: event.target.value }))} />
          </label>
          <label>
            <span>{t("admin.brandDescription")}</span>
            <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
          </label>
          <div className="inline-row">
            <button type="submit" disabled={isSaving}>
              {isSaving ? t("admin.saving") : form.id ? t("admin.updateBrand") : t("admin.createBrand")}
            </button>
            {form.id ? (
              <button type="button" className="ghost-btn" onClick={() => setForm(defaultBrandForm)}>
                {t("common.cancel")}
              </button>
            ) : null}
          </div>
        </form>

        <div className="surface form">
          <div className="admin-section-head">
            <div>
              <h2>{t("admin.brandsTitle")}</h2>
              <p className="muted">{t("admin.brandsDescription")}</p>
            </div>
            <span className="muted">{t("admin.brandsFound", { count: pagination.total })}</span>
          </div>
          <div className="admin-directory-toolbar">
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={t("admin.searchBrands")}
            />
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as DirectorySort);
                setPage(1);
              }}
            >
              <option value="name_asc">{t("admin.sortNameAsc")}</option>
              <option value="name_desc">{t("admin.sortNameDesc")}</option>
              <option value="newest">{t("admin.sortNewest")}</option>
              <option value="oldest">{t("admin.sortOldest")}</option>
            </select>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              aria-label={t("admin.pageSizeLabel")}
            >
              <option value={10}>{t("admin.pageSize", { count: 10 })}</option>
              <option value={25}>{t("admin.pageSize", { count: 25 })}</option>
              <option value={50}>{t("admin.pageSize", { count: 50 })}</option>
            </select>
          </div>
          {notice ? <p className="success-text">{notice}</p> : null}
          {isLoading ? <p className="muted">{t("admin.loadingData")}</p> : null}
          {error ? <p className="error">{error}</p> : null}
          {!isLoading && !items.length ? <p className="empty-state">{t("admin.noBrandsFound")}</p> : null}
          {items.map((brand) => (
            <article key={brand.id} className="brand-admin-item">
              <img src={brand.logo_url || "https://dummyimage.com/120x50/e2e8f0/0f172a&text=Brand"} alt={brand.name} />
              <div>
                <strong>{brand.name}</strong>
                <p className="muted">{brand.slug}</p>
                <small>{t("admin.productsCount", { count: brand.productsCount ?? 0 })}</small>
              </div>
              <div className="inline-row">
                <button type="button" className="ghost-btn" onClick={() => startEdit(brand)}>
                  {t("common.edit")}
                </button>
                <button type="button" className="danger" onClick={() => deleteBrand(brand)}>
                  {t("common.delete")}
                </button>
              </div>
            </article>
          ))}
          <div className="pagination">
            <button type="button" disabled={isLoading || pagination.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              {t("common.back")}
            </button>
            <span>{t("admin.pageOf", { page: pagination.page, totalPages: pagination.totalPages })}</span>
            <button type="button" disabled={isLoading || pagination.page >= pagination.totalPages} onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}>
              {t("common.next")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AdminBrandsManager;

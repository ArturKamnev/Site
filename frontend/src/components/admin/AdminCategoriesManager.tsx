import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { isAxiosError } from "axios";

import { useI18n } from "../../i18n/I18nProvider";
import { api } from "../../lib/api";
import type { AdminCategoriesResponse, Category } from "../../types";
import { defaultPagination, getApiErrorMessage } from "./adminHelpers";

type DirectorySort = "name_asc" | "name_desc" | "newest" | "oldest";

type CategoryForm = {
  id: number | null;
  name: string;
  slug: string;
  description: string;
};

const defaultCategoryForm: CategoryForm = {
  id: null,
  name: "",
  slug: "",
  description: "",
};

type Props = {
  onChanged: () => void;
};

const AdminCategoriesManager = ({ onChanged }: Props) => {
  const { t } = useI18n();
  const [items, setItems] = useState<Category[]>([]);
  const [pagination, setPagination] = useState(defaultPagination);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<DirectorySort>("name_asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [form, setForm] = useState<CategoryForm>(defaultCategoryForm);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await api.get<AdminCategoriesResponse>("/admin/categories", {
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
    loadCategories();
  }, [loadCategories]);

  const submitCategory = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSaving(true);

    const payload = {
      name: form.name,
      slug: form.slug || undefined,
      description: form.description || "",
    };

    try {
      if (form.id) {
        await api.put(`/admin/categories/${form.id}`, payload);
      } else {
        await api.post("/admin/categories", payload);
      }
      setForm(defaultCategoryForm);
      setNotice(t("admin.categorySaved"));
      onChanged();
      await loadCategories();
    } catch (saveError) {
      setError(getApiErrorMessage(saveError, t("admin.categorySaveFailed")));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCategory = async (category: Category) => {
    if (!window.confirm(`${t("admin.confirmDelete")}\n\n${t("admin.deleteWarning")}`)) {
      return;
    }

    setError("");
    setNotice("");
    try {
      await api.delete(`/admin/categories/${category.id}`);
      onChanged();
      if (items.length === 1 && page > 1) {
        setPage((current) => current - 1);
        return;
      }
      await loadCategories();
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
        <form className="form surface" onSubmit={submitCategory}>
          <div>
            <h2>{form.id ? t("admin.updateCategory") : t("admin.createCategory")}</h2>
            <p className="muted">{t("admin.categoriesDescription")}</p>
          </div>
          <label>
            <span>{t("admin.categoryName")}</span>
            <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
          </label>
          <label>
            <span>{t("admin.slugOptional")}</span>
            <input value={form.slug} onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))} />
          </label>
          <label>
            <span>{t("admin.categoryDescription")}</span>
            <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
          </label>
          <div className="inline-row">
            <button type="submit" disabled={isSaving}>
              {isSaving ? t("admin.saving") : form.id ? t("admin.updateCategory") : t("admin.createCategory")}
            </button>
            {form.id ? (
              <button type="button" className="ghost-btn" onClick={() => setForm(defaultCategoryForm)}>
                {t("common.cancel")}
              </button>
            ) : null}
          </div>
        </form>

        <div className="table-wrap surface">
          <div className="admin-section-head">
            <div>
              <h2>{t("admin.categoriesTitle")}</h2>
              <p className="muted">{t("admin.categoriesDescription")}</p>
            </div>
            <span className="muted">{t("admin.categoriesFound", { count: pagination.total })}</span>
          </div>
          <div className="admin-directory-toolbar">
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={t("admin.searchCategories")}
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
          {!isLoading && !items.length ? <p className="empty-state">{t("admin.noCategoriesFound")}</p> : null}
          <table>
            <thead>
              <tr>
                <th>{t("common.name")}</th>
                <th>{t("admin.slug")}</th>
                <th>{t("admin.productsCountLabel")}</th>
                <th>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((category) => (
                <tr key={category.id}>
                  <td>{category.name}</td>
                  <td>{category.slug}</td>
                  <td>{category.productsCount ?? 0}</td>
                  <td>
                    <div className="inline-row">
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() =>
                          setForm({
                            id: category.id,
                            name: category.name,
                            slug: category.slug,
                            description: category.description || "",
                          })
                        }
                      >
                        {t("common.edit")}
                      </button>
                      <button type="button" className="danger" onClick={() => deleteCategory(category)}>
                        {t("common.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

export default AdminCategoriesManager;

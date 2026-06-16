import { useCallback, useEffect, useState } from "react";

import { useI18n } from "../../i18n/I18nProvider";
import { api } from "../../lib/api";
import type { AdminOption, AdminProductsResponse, Product } from "../../types";
import { defaultPagination, getApiErrorMessage } from "./adminHelpers";
import AdminProductCreateForm from "./AdminProductCreateForm";
import AdminProductEditModal from "./AdminProductEditModal";

type ProductAvailabilityFilter = "all" | "in_stock" | "out_of_stock" | "hidden";
type ProductDiscountFilter = "all" | "with_discount" | "without_discount";
type ProductSort =
  | "newest"
  | "oldest"
  | "name_asc"
  | "name_desc"
  | "price_asc"
  | "price_desc"
  | "stock_asc"
  | "stock_desc";

type Props = {
  onChanged: () => void;
};

const AdminProductsManager = ({ onChanged }: Props) => {
  const { t, formatMoney } = useI18n();
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState(defaultPagination);
  const [brands, setBrands] = useState<AdminOption[]>([]);
  const [categories, setCategories] = useState<AdminOption[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<ProductAvailabilityFilter>("all");
  const [discountFilter, setDiscountFilter] = useState<ProductDiscountFilter>("all");
  const [sort, setSort] = useState<ProductSort>("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [discountDrafts, setDiscountDrafts] = useState<Record<number, string>>({});
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const loadOptions = useCallback(async () => {
    const [brandResponse, categoryResponse] = await Promise.all([
      api.get<AdminOption[]>("/admin/brands/options"),
      api.get<AdminOption[]>("/admin/categories/options"),
    ]);
    setBrands(brandResponse.data);
    setCategories(categoryResponse.data);
  }, []);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await api.get<AdminProductsResponse>("/admin/products", {
        params: {
          page,
          pageSize,
          search: debouncedSearch || undefined,
          brandId: brandFilter || undefined,
          categoryId: categoryFilter || undefined,
          availability: availabilityFilter,
          discount: discountFilter,
          sort,
        },
      });

      setProducts(response.data.items);
      setPagination(response.data.pagination);
      setDiscountDrafts((prev) => ({
        ...prev,
        ...Object.fromEntries(response.data.items.map((item) => [item.id, String(item.discount_percent ?? 0)])),
      }));
    } catch (loadError) {
      setProducts([]);
      setPagination(defaultPagination);
      setError(getApiErrorMessage(loadError, t("errors.generic")));
    } finally {
      setIsLoading(false);
    }
  }, [availabilityFilter, brandFilter, categoryFilter, debouncedSearch, discountFilter, page, pageSize, sort, t]);

  useEffect(() => {
    loadOptions().catch(() => setError(t("errors.generic")));
  }, [loadOptions, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const refreshAfterMutation = async () => {
    setNotice("");
    onChanged();
    await loadOptions();
    await loadProducts();
  };

  const applyProductDiscount = async (productId: number, discountValue: number) => {
    setError("");
    try {
      await api.patch(`/admin/products/${productId}/discount`, {
        discountPercent: Math.max(0, Math.min(discountValue, 95)),
      });
      await loadProducts();
    } catch (discountError) {
      setError(getApiErrorMessage(discountError, t("errors.generic")));
    }
  };

  const deleteProduct = async (productId: number) => {
    if (!window.confirm(`${t("admin.confirmDelete")}\n\n${t("admin.deleteWarning")}`)) {
      return;
    }

    setError("");
    try {
      await api.delete(`/admin/products/${productId}`);
      onChanged();

      if (products.length === 1 && page > 1) {
        setPage((current) => current - 1);
        return;
      }

      await loadProducts();
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError, t("admin.deleteFailed")));
    }
  };

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setBrandFilter("");
    setCategoryFilter("");
    setAvailabilityFilter("all");
    setDiscountFilter("all");
    setSort("newest");
    setPageSize(25);
    setPage(1);
  };

  return (
    <section className="admin-section">
      <AdminProductCreateForm brands={brands} categories={categories} onCreated={refreshAfterMutation} />

      <div className="table-wrap surface">
        <div className="admin-section-head">
          <div>
            <h2>{t("admin.productsAndDiscounts")}</h2>
            <p className="muted">{t("admin.productEditDescription")}</p>
          </div>
        </div>
        <div className="admin-products-toolbar">
          <div className="admin-products-toolbar-head">
            <strong>{t("admin.filters")}</strong>
            <span className="muted">{t("admin.productsFound", { count: pagination.total })}</span>
          </div>
          <div className="admin-products-filters">
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={t("admin.productsSearchPlaceholder")}
            />
            <select
              value={brandFilter}
              onChange={(event) => {
                setBrandFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("admin.allBrands")}</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(event) => {
                setCategoryFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("admin.allCategories")}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              value={availabilityFilter}
              onChange={(event) => {
                setAvailabilityFilter(event.target.value as ProductAvailabilityFilter);
                setPage(1);
              }}
              aria-label={t("admin.availability")}
            >
              <option value="all">{t("admin.availabilityAll")}</option>
              <option value="in_stock">{t("admin.availabilityInStock")}</option>
              <option value="out_of_stock">{t("admin.availabilityOutOfStock")}</option>
              <option value="hidden">{t("admin.availabilityHidden")}</option>
            </select>
            <select
              value={discountFilter}
              onChange={(event) => {
                setDiscountFilter(event.target.value as ProductDiscountFilter);
                setPage(1);
              }}
              aria-label={t("admin.discountFilter")}
            >
              <option value="all">{t("admin.discountAll")}</option>
              <option value="with_discount">{t("admin.discountWith")}</option>
              <option value="without_discount">{t("admin.discountWithout")}</option>
            </select>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as ProductSort);
                setPage(1);
              }}
              aria-label={t("common.sort")}
            >
              <option value="newest">{t("admin.sortNewest")}</option>
              <option value="oldest">{t("admin.sortOldest")}</option>
              <option value="name_asc">{t("admin.sortNameAsc")}</option>
              <option value="name_desc">{t("admin.sortNameDesc")}</option>
              <option value="price_asc">{t("admin.sortPriceAsc")}</option>
              <option value="price_desc">{t("admin.sortPriceDesc")}</option>
              <option value="stock_asc">{t("admin.sortStockAsc")}</option>
              <option value="stock_desc">{t("admin.sortStockDesc")}</option>
            </select>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              aria-label={t("admin.pageSizeLabel")}
            >
              <option value={25}>{t("admin.pageSize", { count: 25 })}</option>
              <option value={50}>{t("admin.pageSize", { count: 50 })}</option>
              <option value={100}>{t("admin.pageSize", { count: 100 })}</option>
            </select>
            <button type="button" className="ghost-btn" onClick={clearFilters}>
              {t("admin.clearFilters")}
            </button>
          </div>
        </div>
        {notice ? <p className="success-text admin-products-status">{notice}</p> : null}
        {isLoading ? <p className="muted admin-products-status">{t("admin.loadingData")}</p> : null}
        {error ? <p className="error admin-products-status">{error}</p> : null}
        {!isLoading && !error && !products.length ? <p className="empty-state">{t("admin.noProductsFound")}</p> : null}
        {products.length ? (
          <table className="admin-products-table">
            <thead>
              <tr>
                <th>{t("common.id")}</th>
                <th>{t("common.name")}</th>
                <th>{t("common.price")}</th>
                <th>{t("admin.discount")}</th>
                <th>{t("admin.brand")}</th>
                <th>{t("common.category")}</th>
                <th>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>{product.id}</td>
                  <td>
                    <div className="admin-product-cell">
                      <strong>{product.name}</strong>
                      <span className="muted">
                        {t("common.sku")}: {product.sku}
                      </span>
                      <span className={product.is_available ? "status-chip success" : "status-chip muted-chip"}>
                        {product.is_available ? t("admin.isAvailable") : t("common.hidden")}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="table-price-cell">
                      <strong>{formatMoney(product.price)}</strong>
                      {product.old_price ? <small>{formatMoney(product.old_price)}</small> : null}
                    </div>
                  </td>
                  <td>
                    <div className="inline-row admin-discount-row">
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
                        aria-label={t("admin.discountPercent")}
                      />
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => applyProductDiscount(product.id, Number(discountDrafts[product.id] ?? product.discount_percent ?? 0))}
                      >
                        {t("admin.applyDiscount")}
                      </button>
                      <button type="button" className="ghost-btn" onClick={() => applyProductDiscount(product.id, 0)}>
                        {t("admin.removeDiscount")}
                      </button>
                    </div>
                  </td>
                  <td>{product.brandName || t("admin.noData")}</td>
                  <td>{product.categoryName || t("admin.noData")}</td>
                  <td>
                    <div className="inline-row admin-row-actions">
                      <button type="button" className="ghost-btn" onClick={() => setEditingProduct(product)} aria-label={t("admin.openProductEditor", { name: product.name })}>
                        {t("admin.editProduct")}
                      </button>
                      <button type="button" className="danger" onClick={() => deleteProduct(product.id)}>
                        {t("common.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
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

      {editingProduct ? (
        <AdminProductEditModal
          product={editingProduct}
          brands={brands}
          categories={categories}
          onClose={() => setEditingProduct(null)}
          onSaved={async () => {
            setEditingProduct(null);
            setNotice(t("admin.productSaved"));
            onChanged();
            await loadProducts();
          }}
        />
      ) : null}
    </section>
  );
};

export default AdminProductsManager;

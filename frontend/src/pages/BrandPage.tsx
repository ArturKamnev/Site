import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { useI18n } from "../i18n/I18nProvider";
import { api } from "../lib/api";
import type { Brand, Category, Product } from "../types";

type BrandProductsResponse = {
  brand: Brand;
  filters: {
    categories: Category[];
    manufacturers: string[];
  };
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  items: Product[];
};

const BrandPage = () => {
  const { t } = useI18n();
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<BrandProductsResponse | null>(null);

  useEffect(() => {
    api
      .get<BrandProductsResponse>(`/brands/${slug}/products`, {
        params: Object.fromEntries(searchParams.entries()),
      })
      .then((response) => setData(response.data));
  }, [slug, searchParams]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value) next.delete(key);
    else next.set(key, value);

    if (key !== "page") {
      next.delete("page");
    }

    setSearchParams(next);
  };

  return (
    <section className="brand-page">
      <div className="brand-hero surface">
        <img
          src={data?.brand.logo_url || "https://dummyimage.com/500x180/e2e8f0/0f172a&text=Brand"}
          alt={data?.brand.name ?? t("brandPage.fallbackBrand")}
        />
        <div>
          <h1>{data?.brand.name ?? t("brandPage.fallbackBrand")}</h1>
          <p>{data?.brand.description || t("brandPage.fallbackDescription")}</p>
        </div>
      </div>

      <div className="catalog-layout">
        <aside className="surface filter-panel">
          <h3>{t("brandPage.filters")}</h3>
          <div className="filter-stack">
            <input
              placeholder={t("brandPage.searchPlaceholder")}
              value={searchParams.get("search") ?? ""}
              onChange={(event) => updateParam("search", event.target.value)}
            />
            <select value={searchParams.get("categoryId") ?? ""} onChange={(event) => updateParam("categoryId", event.target.value)}>
              <option value="">{t("brandPage.allCategories")}</option>
              {data?.filters.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select value={searchParams.get("manufacturer") ?? ""} onChange={(event) => updateParam("manufacturer", event.target.value)}>
              <option value="">{t("brandPage.allManufacturers")}</option>
              {data?.filters.manufacturers.map((manufacturer) => (
                <option key={manufacturer} value={manufacturer}>
                  {manufacturer}
                </option>
              ))}
            </select>
            <label className="inline-checkbox">
              <input
                type="checkbox"
                checked={searchParams.get("inStock") === "true"}
                onChange={(event) => updateParam("inStock", event.target.checked ? "true" : "")}
              />
              {t("common.inStockOnly")}
            </label>
          </div>
        </aside>

        <div>
          <div className="surface catalog-toolbar">
            <p>{t("common.itemsFound", { count: data?.pagination.total ?? 0 })}</p>
            <select value={searchParams.get("sort") ?? "new"} onChange={(event) => updateParam("sort", event.target.value)}>
              <option value="new">{t("brandPage.sortNewest")}</option>
              <option value="price_asc">{t("brandPage.sortPriceAsc")}</option>
              <option value="price_desc">{t("brandPage.sortPriceDesc")}</option>
              <option value="name_asc">{t("brandPage.sortNameAsc")}</option>
            </select>
          </div>

          <div className="grid grid-products">
            {data?.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {!data?.items.length ? <p className="empty-state">{t("brandPage.empty")}</p> : null}

          <div className="pagination">
            <button
              type="button"
              disabled={!data || data.pagination.page <= 1}
              onClick={() => updateParam("page", String((data?.pagination.page ?? 1) - 1))}
            >
              {t("common.back")}
            </button>
            <span>{t("brandPage.pageOf", { page: data?.pagination.page ?? 1, totalPages: data?.pagination.totalPages ?? 1 })}</span>
            <button
              type="button"
              disabled={!data || (data.pagination.page ?? 1) >= (data.pagination.totalPages ?? 1)}
              onClick={() => updateParam("page", String((data?.pagination.page ?? 1) + 1))}
            >
              {t("common.next")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BrandPage;

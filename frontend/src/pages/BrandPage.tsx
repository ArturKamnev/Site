import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import ProductCard from "../components/ProductCard";
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
          alt={data?.brand.name ?? "Бренд"}
        />
        <div>
          <h1>{data?.brand.name ?? "Бренд"}</h1>
          <p>{data?.brand.description || "Выберите подходящие запчасти по параметрам ниже."}</p>
        </div>
      </div>

      <div className="catalog-layout">
        <aside className="surface filter-panel">
          <h3>Фильтры</h3>
          <div className="filter-stack">
            <input
              placeholder="Поиск по названию, SKU, артикулу"
              value={searchParams.get("search") ?? ""}
              onChange={(event) => updateParam("search", event.target.value)}
            />
            <select value={searchParams.get("categoryId") ?? ""} onChange={(event) => updateParam("categoryId", event.target.value)}>
              <option value="">Все категории</option>
              {data?.filters.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select value={searchParams.get("manufacturer") ?? ""} onChange={(event) => updateParam("manufacturer", event.target.value)}>
              <option value="">Все производители</option>
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
              Только в наличии
            </label>
          </div>
        </aside>

        <div>
          <div className="surface catalog-toolbar">
            <p>Найдено товаров: {data?.pagination.total ?? 0}</p>
            <select value={searchParams.get("sort") ?? "new"} onChange={(event) => updateParam("sort", event.target.value)}>
              <option value="new">Сначала новые</option>
              <option value="price_asc">Цена по возрастанию</option>
              <option value="price_desc">Цена по убыванию</option>
              <option value="name_asc">Название A-Z</option>
            </select>
          </div>

          <div className="grid grid-products">
            {data?.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {!data?.items.length ? <p className="empty-state">По выбранным фильтрам товары не найдены.</p> : null}

          <div className="pagination">
            <button
              type="button"
              disabled={!data || data.pagination.page <= 1}
              onClick={() => updateParam("page", String((data?.pagination.page ?? 1) - 1))}
            >
              Назад
            </button>
            <span>
              Страница {data?.pagination.page ?? 1} из {data?.pagination.totalPages ?? 1}
            </span>
            <button
              type="button"
              disabled={!data || (data.pagination.page ?? 1) >= (data.pagination.totalPages ?? 1)}
              onClick={() => updateParam("page", String((data?.pagination.page ?? 1) + 1))}
            >
              Вперед
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BrandPage;

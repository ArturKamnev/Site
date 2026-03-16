import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Brand } from "../types";

const BrandsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [brands, setBrands] = useState<Brand[]>([]);
  const search = searchParams.get("search") ?? "";

  useEffect(() => {
    api
      .get<Brand[]>("/brands", { params: { search: search || undefined } })
      .then((response) => setBrands(response.data));
  }, [search]);

  return (
    <section className="catalog-page">
      <div className="title-block">
        <h1>Каталог брендов</h1>
        <p>Выберите бренд, чтобы перейти к товарам и настроить фильтры по категориям, производителям и наличию.</p>
      </div>

      <div className="surface panel-row">
        <input
          value={search}
          onChange={(event) => {
            const value = event.target.value;
            setSearchParams(value.trim() ? { search: value } : {});
          }}
          placeholder="Поиск бренда"
        />
      </div>

      <div className="grid grid-brand">
        {brands.map((brand) => (
          <Link key={brand.id} to={`/brand/${brand.slug}`} className="card brand-card">
            <img src={brand.logo_url || "https://dummyimage.com/280x120/e2e8f0/0f172a&text=Brand"} alt={brand.name} />
            <div className="card-body">
              <h3>{brand.name}</h3>
              <p className="muted">{brand.description || "Оригинальные и совместимые решения для грузовой техники."}</p>
              <small className="meta-chip">{brand.productsCount || 0} товаров</small>
            </div>
          </Link>
        ))}
      </div>

      {!brands.length ? <p className="empty-state">По вашему запросу бренды не найдены.</p> : null}
    </section>
  );
};

export default BrandsPage;

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { api } from "../lib/api";
import type { Brand } from "../types";

const BrandsPage = () => {
  const { t } = useI18n();
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
        <h1>{t("brands.title")}</h1>
        <p>{t("brands.description")}</p>
      </div>

      <div className="surface panel-row">
        <input
          value={search}
          onChange={(event) => {
            const value = event.target.value;
            setSearchParams(value.trim() ? { search: value } : {});
          }}
          placeholder={t("brands.searchPlaceholder")}
        />
      </div>

      <div className="grid grid-brand">
        {brands.map((brand) => (
          <Link key={brand.id} to={`/brand/${brand.slug}`} className="card brand-card">
            <img src={brand.logo_url || "https://dummyimage.com/280x120/e2e8f0/0f172a&text=Brand"} alt={brand.name} />
            <div className="card-body">
              <h3>{brand.name}</h3>
              <p className="muted">{brand.description || t("brands.noDescription")}</p>
              <small className="meta-chip">{t("brands.productsCount", { count: brand.productsCount || 0 })}</small>
            </div>
          </Link>
        ))}
      </div>

      {!brands.length ? <p className="empty-state">{t("brands.empty")}</p> : null}
    </section>
  );
};

export default BrandsPage;

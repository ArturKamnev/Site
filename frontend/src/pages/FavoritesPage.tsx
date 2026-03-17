import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { useI18n } from "../i18n/I18nProvider";
import { useFavoritesStore } from "../stores/favoritesStore";

const FavoritesPage = () => {
  const { t } = useI18n();
  const favorites = useFavoritesStore((state) => state.items);

  return (
    <section className="favorites-page">
      <div className="title-block">
        <h1>{t("favorites.title")}</h1>
        <p>{t("favorites.description")}</p>
      </div>

      {!favorites.length ? (
        <div className="empty-state">
          {t("favorites.empty")}. <Link to="/brands">{t("home.openCatalog")}</Link>
        </div>
      ) : null}

      <div className="grid grid-products">
        {favorites.map((item) => (
          <ProductCard key={item.id} product={item} />
        ))}
      </div>
    </section>
  );
};

export default FavoritesPage;

import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { useFavoritesStore } from "../stores/favoritesStore";

const FavoritesPage = () => {
  const favorites = useFavoritesStore((state) => state.items);

  return (
    <section className="favorites-page">
      <div className="title-block">
        <h1>Избранное</h1>
        <p>Сохраненные товары для быстрого возврата к покупке.</p>
      </div>

      {!favorites.length ? (
        <div className="empty-state">
          В избранном пока пусто. <Link to="/brands">Перейти в каталог</Link>
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

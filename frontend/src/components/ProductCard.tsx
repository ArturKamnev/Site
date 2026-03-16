import { Link } from "react-router-dom";
import { useCartStore } from "../stores/cartStore";
import { useFavoritesStore } from "../stores/favoritesStore";
import type { Product } from "../types";

type Props = {
  product: Product;
};

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const ProductCard = ({ product }: Props) => {
  const addItem = useCartStore((state) => state.addItem);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const isFavorite = useFavoritesStore((state) => state.isFavorite(product.id));
  const hasDiscount =
    (product.discount_percent ?? 0) > 0 &&
    Boolean(product.old_price) &&
    Number(product.old_price) > product.price;

  return (
    <article className="card product-card">
      <button
        type="button"
        className={`favorite-btn ${isFavorite ? "active" : ""}`}
        onClick={() => toggleFavorite(product)}
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      >
        {isFavorite ? "In favorites" : "Favorite"}
      </button>

      {hasDiscount ? <span className="discount-badge">-{product.discount_percent}%</span> : null}

      <Link to={`/product/${product.slug}`} className="product-card-media">
        <img src={product.image || "https://dummyimage.com/800x600/e2e8f0/0f172a&text=No+Image"} alt={product.name} />
      </Link>
      <div className="card-body product-card-body">
        <p className="muted product-brand">{product.brandName || product.manufacturer || "No brand"}</p>
        <Link to={`/product/${product.slug}`} className="product-title">
          {product.name}
        </Link>
        <p className="muted">Article: {product.article || product.sku || "-"}</p>
        <div className="price-stack">
          <p className="price">{money.format(product.price)}</p>
          {hasDiscount ? <p className="old-price">{money.format(Number(product.old_price))}</p> : null}
        </div>
        <div className="card-actions">
          <Link to={`/product/${product.slug}`} className="ghost-btn">
            Details
          </Link>
          <button type="button" onClick={() => addItem(product, 1)} disabled={product.stock <= 0}>
            Add to cart
          </button>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;

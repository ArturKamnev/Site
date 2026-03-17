import { Link } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { useCartStore } from "../stores/cartStore";
import { useFavoritesStore } from "../stores/favoritesStore";
import type { Product } from "../types";

type Props = {
  product: Product;
};

const ProductCard = ({ product }: Props) => {
  const { t, formatMoney } = useI18n();
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const isFavorite = useFavoritesStore((state) => state.isFavorite(product.id));
  const alreadyInCart = items.find(
    (item) => (item.product_id ?? item.product?.id) === product.id,
  )?.quantity;
  const canAddToCart = product.stock > 0 && (alreadyInCart ?? 0) < product.stock;
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
        aria-label={isFavorite ? t("productCard.removeFromFavorites") : t("productCard.addToFavorites")}
      >
        {isFavorite ? t("productCard.inFavorites") : t("productCard.addFavorite")}
      </button>

      {hasDiscount ? <span className="discount-badge">-{product.discount_percent}%</span> : null}

      <Link to={`/product/${product.slug}`} className="product-card-media">
        <img src={product.image || "https://dummyimage.com/800x600/e2e8f0/0f172a&text=No+Image"} alt={product.name} />
      </Link>
      <div className="card-body product-card-body">
        <p className="muted product-brand">{product.brandName || product.manufacturer || t("productCard.noBrand")}</p>
        <Link to={`/product/${product.slug}`} className="product-title">
          {product.name}
        </Link>
        <p className="muted">
          {t("common.article")}: {product.article || product.sku || "-"}
        </p>
        <div className="price-stack">
          <p className="price">{formatMoney(product.price)}</p>
          {hasDiscount ? <p className="old-price">{formatMoney(Number(product.old_price))}</p> : null}
        </div>
        <div className="card-actions">
          <Link to={`/product/${product.slug}`} className="ghost-btn">
            {t("productCard.details")}
          </Link>
          <button
            type="button"
            onClick={() => addItem(product, 1)}
            disabled={!canAddToCart}
            title={!canAddToCart ? t("cart.stockLimitHint", { stock: product.stock }) : undefined}
          >
            {t("productCard.addToCart")}
          </button>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;

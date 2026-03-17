import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { api } from "../lib/api";
import { useCartStore } from "../stores/cartStore";
import { useFavoritesStore } from "../stores/favoritesStore";
import { useRecentlyViewedStore } from "../stores/recentlyViewedStore";
import type { Product } from "../types";

type ProductFull = Product & { images: Array<{ id: number; url: string; alt?: string }> };

const ProductPage = () => {
  const { t, formatMoney } = useI18n();
  const { slug } = useParams();
  const [product, setProduct] = useState<ProductFull | null>(null);
  const addItem = useCartStore((state) => state.addItem);
  const cartItems = useCartStore((state) => state.items);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const isFavorite = useFavoritesStore((state) => (product ? state.isFavorite(product.id) : false));
  const addRecentlyViewed = useRecentlyViewedStore((state) => state.addItem);

  useEffect(() => {
    api.get<ProductFull>(`/products/${slug}`).then((response) => {
      setProduct(response.data);
      addRecentlyViewed(response.data);
    });
  }, [slug, addRecentlyViewed]);

  if (!product) return <p className="empty-state">{t("productPage.loading")}</p>;

  const hasDiscount =
    (product.discount_percent ?? 0) > 0 &&
    Boolean(product.old_price) &&
    Number(product.old_price) > product.price;

  const quantityInCart = cartItems.find((item) => (item.product_id ?? item.product?.id) === product.id)?.quantity ?? 0;
  const canAddToCart = product.stock > 0 && quantityInCart < product.stock;

  return (
    <section className="product-view">
      <div className="gallery card">
        <img src={product.image || product.images?.[0]?.url} alt={product.name} />
      </div>

      <div className="product-detail surface">
        <p className="muted">{product.brandName}</p>
        <h1>{product.name}</h1>

        <div className="product-meta-row">
          <span className="meta-chip">{t("common.article")}: {product.article || "-"}</span>
          <span className="meta-chip">{t("common.sku")}: {product.sku}</span>
          <span className="meta-chip">{t("productPage.partId")}: {product.part_id || "-"}</span>
        </div>

        <div className="price-stack">
          <p className="price">{formatMoney(product.price)}</p>
          {hasDiscount ? <p className="old-price">{formatMoney(Number(product.old_price))}</p> : null}
          {hasDiscount ? <span className="discount-badge">-{product.discount_percent}%</span> : null}
        </div>

        <p className="muted">
          {t("productPage.categoryManufacturer", {
            category: product.categoryName || "-",
            manufacturer: product.manufacturer || "-",
          })}
        </p>

        <div className="stock-badge">
          {product.stock > 0 ? t("productPage.inStock", { stock: product.stock }) : t("productPage.outOfStock")}
        </div>

        <div className="product-main-actions">
          <button type="button" onClick={() => addItem(product, 1)} disabled={!canAddToCart}>
            {t("productCard.addToCart")}
          </button>
          <button type="button" className="ghost-btn" onClick={() => toggleFavorite(product)}>
            {isFavorite ? t("productPage.removeFavorite") : t("productPage.addFavorite")}
          </button>
        </div>
        {product.stock > 0 && quantityInCart >= product.stock ? (
          <p className="muted">{t("cart.stockLimitHint", { stock: product.stock })}</p>
        ) : null}

        <div className="description-card">
          <h3>{t("productPage.description")}</h3>
          <p>{product.description || t("common.noDescription")}</p>
        </div>
      </div>
    </section>
  );
};

export default ProductPage;

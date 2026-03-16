import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useCartStore } from "../stores/cartStore";
import { useFavoritesStore } from "../stores/favoritesStore";
import { useRecentlyViewedStore } from "../stores/recentlyViewedStore";
import type { Product } from "../types";

type ProductFull = Product & { images: Array<{ id: number; url: string; alt?: string }> };

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const ProductPage = () => {
  const { slug } = useParams();
  const [product, setProduct] = useState<ProductFull | null>(null);
  const addItem = useCartStore((state) => state.addItem);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const isFavorite = useFavoritesStore((state) => (product ? state.isFavorite(product.id) : false));
  const addRecentlyViewed = useRecentlyViewedStore((state) => state.addItem);

  useEffect(() => {
    api.get<ProductFull>(`/products/${slug}`).then((response) => {
      setProduct(response.data);
      addRecentlyViewed(response.data);
    });
  }, [slug, addRecentlyViewed]);

  if (!product) return <p className="empty-state">Loading product...</p>;

  const hasDiscount =
    (product.discount_percent ?? 0) > 0 &&
    Boolean(product.old_price) &&
    Number(product.old_price) > product.price;

  return (
    <section className="product-view">
      <div className="gallery card">
        <img src={product.image || product.images?.[0]?.url} alt={product.name} />
      </div>

      <div className="product-detail surface">
        <p className="muted">{product.brandName}</p>
        <h1>{product.name}</h1>

        <div className="product-meta-row">
          <span className="meta-chip">Article: {product.article || "-"}</span>
          <span className="meta-chip">SKU: {product.sku}</span>
          <span className="meta-chip">Part ID: {product.part_id || "-"}</span>
        </div>

        <div className="price-stack">
          <p className="price">{money.format(product.price)}</p>
          {hasDiscount ? <p className="old-price">{money.format(Number(product.old_price))}</p> : null}
          {hasDiscount ? <span className="discount-badge">-{product.discount_percent}%</span> : null}
        </div>

        <p className="muted">
          Category: {product.categoryName || "-"} | Manufacturer: {product.manufacturer || "-"}
        </p>

        <div className="stock-badge">{product.stock > 0 ? `In stock: ${product.stock}` : "Out of stock"}</div>

        <div className="product-main-actions">
          <button type="button" onClick={() => addItem(product, 1)} disabled={product.stock <= 0}>
            Add to cart
          </button>
          <button type="button" className="ghost-btn" onClick={() => toggleFavorite(product)}>
            {isFavorite ? "Remove favorite" : "Add favorite"}
          </button>
        </div>

        <div className="description-card">
          <h3>Description</h3>
          <p>{product.description || "No description yet."}</p>
        </div>
      </div>
    </section>
  );
};

export default ProductPage;

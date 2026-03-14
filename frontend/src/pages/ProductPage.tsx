import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useCartStore } from "../stores/cartStore";
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

  useEffect(() => {
    api.get<ProductFull>(`/products/${slug}`).then((response) => setProduct(response.data));
  }, [slug]);

  if (!product) return <p className="empty-state">Загрузка товара...</p>;

  return (
    <section className="product-view">
      <div className="gallery card">
        <img src={product.image || product.images?.[0]?.url} alt={product.name} />
      </div>

      <div className="product-detail surface">
        <p className="muted">{product.brandName}</p>
        <h1>{product.name}</h1>

        <div className="product-meta-row">
          <span className="meta-chip">Артикул: {product.article || "-"}</span>
          <span className="meta-chip">SKU: {product.sku}</span>
          <span className="meta-chip">Part ID: {product.part_id || "-"}</span>
        </div>

        <p className="price">{money.format(product.price)}</p>
        <p className="muted">
          Категория: {product.categoryName || "-"} | Производитель: {product.manufacturer || "-"}
        </p>

        <div className="stock-badge">
          {product.stock > 0 ? `В наличии: ${product.stock} шт.` : "Нет в наличии"}
        </div>

        <button type="button" onClick={() => addItem(product, 1)} disabled={product.stock <= 0}>
          Добавить в корзину
        </button>

        <div className="description-card">
          <h3>Описание и характеристики</h3>
          <p>{product.description || "Описание пока не добавлено."}</p>
        </div>
      </div>
    </section>
  );
};

export default ProductPage;

import { Link } from "react-router-dom";
import { useCartStore } from "../stores/cartStore";
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

  return (
    <article className="card product-card">
      <Link to={`/products/${product.slug}`} className="product-card-media">
        <img src={product.image || "https://dummyimage.com/800x600/e2e8f0/0f172a&text=No+Image"} alt={product.name} />
      </Link>
      <div className="card-body product-card-body">
        <p className="muted product-brand">{product.brandName || product.manufacturer || "Без бренда"}</p>
        <Link to={`/products/${product.slug}`} className="product-title">
          {product.name}
        </Link>
        <p className="muted">Артикул: {product.article || product.sku || "-"}</p>
        <p className="muted">SKU: {product.sku}</p>
        <p className="price">{money.format(product.price)}</p>
        <div className="card-actions">
          <Link to={`/products/${product.slug}`} className="ghost-btn">
            Подробнее
          </Link>
          <button type="button" onClick={() => addItem(product, 1)} disabled={product.stock <= 0}>
            В корзину
          </button>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;

import axios from "axios";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { useAuthStore } from "../stores/authStore";
import { useCartStore } from "../stores/cartStore";
import { useFavoritesStore } from "../stores/favoritesStore";
import type { Product } from "../types";

const CartPage = () => {
  const { t, formatMoney } = useI18n();
  const { items, total, updateQuantity, removeItem } = useCartStore();
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const isFavorite = useFavoritesStore((state) => state.isFavorite);
  const user = useAuthStore((state) => state.user);
  const [errorMessage, setErrorMessage] = useState("");
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const resolveStock = (item: (typeof items)[number]) => item.stock ?? item.product?.stock ?? 0;

  const getStockErrorMessage = (error: unknown, fallbackStock: number) => {
    if (axios.isAxiosError(error)) {
      const payload = error.response?.data as
        | { code?: string; availableStock?: number; message?: string }
        | undefined;
      if (payload?.code === "CART_STOCK_EXCEEDED") {
        return t("cart.stockLimitError", { stock: payload.availableStock ?? fallbackStock });
      }
    }
    return t("errors.generic");
  };

  const onIncrease = async (item: (typeof items)[number]) => {
    const stock = resolveStock(item);
    const nextQuantity = item.quantity + 1;
    if (stock <= 0 || nextQuantity > stock) {
      setErrorMessage(t("cart.stockLimitError", { stock }));
      return;
    }

    try {
      await updateQuantity(item.id || item.product_id || 0, nextQuantity);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(getStockErrorMessage(error, stock));
    }
  };

  const onDecrease = async (item: (typeof items)[number]) => {
    const nextQuantity = Math.max(1, item.quantity - 1);
    if (nextQuantity === item.quantity) return;
    try {
      await updateQuantity(item.id || item.product_id || 0, nextQuantity);
      setErrorMessage("");
    } catch {
      setErrorMessage(t("errors.generic"));
    }
  };

  return (
    <section className="cart-page">
      <div className="title-block">
        <h1>{t("cart.title")}</h1>
        <p>{t("cart.description")}</p>
      </div>

      {!items.length ? <p className="empty-state">{t("cart.empty")}</p> : null}
      {errorMessage ? <p className="error">{errorMessage}</p> : null}

      <div className="cart-layout">
        <div className="cart-list">
          {items.map((item) => {
            const productId = item.product_id || item.product?.id || 0;
            const unitPrice = item.price || item.product?.price || 0;
            const image = item.image || item.product?.image;
            const title = item.name || item.product?.name;
            const stock = resolveStock(item);
            const rawProduct = (item.product || {
              id: productId,
              name: title,
              slug: item.slug,
              sku: item.sku,
              price: unitPrice,
              image,
              stock,
              is_available: 1,
              brandName: item.brandName,
              categoryName: item.categoryName,
            }) as Product;
            const productLink = rawProduct.slug ? `/product/${rawProduct.slug}` : "/brands";

            return (
              <article key={`${item.id ?? "guest"}-${productId}`} className="card cart-item">
                <img src={image || "https://dummyimage.com/300x200/e2e8f0/0f172a&text=Part"} alt={title} />
                <div className="cart-item-info">
                  <div className="cart-item-head">
                    <h3>{title}</h3>
                    <p className="price">{formatMoney(unitPrice)}</p>
                  </div>
                  <p className="muted">{t("common.sku")}: {item.sku || item.product?.sku}</p>
                  <div className="qty-row" aria-label={t("cart.quantityAria")}>
                    <button type="button" onClick={() => onDecrease(item)}>
                      -
                    </button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => onIncrease(item)} disabled={stock <= 0 || item.quantity >= stock}>
                      +
                    </button>
                    <small className="muted">{t("cart.stockLimitHint", { stock })}</small>
                  </div>
                  <div className="cart-item-actions">
                    <button type="button" className="ghost-btn" onClick={() => removeItem(item.id || productId)}>
                      {t("cart.remove")}
                    </button>
                    <button type="button" className="ghost-btn" onClick={() => toggleFavorite(rawProduct)}>
                      {isFavorite(productId) ? t("productCard.inFavorites") : t("productCard.addFavorite")}
                    </button>
                    <Link className="ghost-btn" to={productLink}>
                      {t("cart.toProduct")}
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <aside className="surface cart-summary">
          <h3>{t("cart.summary")}</h3>
          <div className="summary-row">
            <span>{t("cart.products")}:</span>
            <strong>{totalCount}</strong>
          </div>
          <div className="summary-row">
            <span>{t("cart.positions")}:</span>
            <strong>{items.length}</strong>
          </div>
          <div className="summary-row">
            <span>{t("cart.discount")}:</span>
            <strong>{formatMoney(0)}</strong>
          </div>
          <div className="summary-row summary-total">
            <span>{t("common.total")}:</span>
            <strong>{formatMoney(total)}</strong>
          </div>
          <Link className="checkout-btn" to="/checkout">
            {t("cart.goCheckout")}
          </Link>
        </aside>
      </div>

      <div className="cart-extra-grid">
        <article className="surface">
          <h3>{t("cart.delivery")}</h3>
          <p className="muted">{t("cart.deliveryText")}</p>
        </article>
        <article className="surface">
          <h3>{t("cart.payment")}</h3>
          <p className="muted">{t("cart.paymentText")}</p>
        </article>
        <article className="surface">
          <h3>{t("cart.customerContacts")}</h3>
          <p className="muted">{user ? `${user.name} (${user.email})` : t("cart.loginToPrefill")}</p>
        </article>
      </div>
    </section>
  );
};

export default CartPage;

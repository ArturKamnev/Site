import { Link } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useCartStore } from "../stores/cartStore";
import { useFavoritesStore } from "../stores/favoritesStore";
import type { Product } from "../types";

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const CartPage = () => {
  const { items, total, updateQuantity, removeItem } = useCartStore();
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const isFavorite = useFavoritesStore((state) => state.isFavorite);
  const user = useAuthStore((state) => state.user);
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <section className="cart-page">
      <div className="title-block">
        <h1>Корзина</h1>
        <p>Проверьте состав заказа, количество позиций и итог перед оформлением.</p>
      </div>

      {!items.length ? <p className="empty-state">Корзина пока пуста.</p> : null}

      <div className="cart-layout">
        <div className="cart-list">
          {items.map((item) => {
            const productId = item.product_id || item.product?.id || 0;
            const unitPrice = item.price || item.product?.price || 0;
            const image = item.image || item.product?.image;
            const title = item.name || item.product?.name;
            const rawProduct = (item.product || {
              id: productId,
              name: title,
              slug: item.slug,
              sku: item.sku,
              price: unitPrice,
              image,
              stock: item.stock || 0,
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
                    <p className="price">{money.format(unitPrice)}</p>
                  </div>
                  <p className="muted">SKU: {item.sku || item.product?.sku}</p>
                  <div className="qty-row">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id || productId, Math.max(1, item.quantity - 1))}
                    >
                      -
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id || productId, Math.min(99, item.quantity + 1))}
                    >
                      +
                    </button>
                  </div>
                  <div className="cart-item-actions">
                    <button type="button" className="ghost-btn" onClick={() => removeItem(item.id || productId)}>
                      Удалить
                    </button>
                    <button type="button" className="ghost-btn" onClick={() => toggleFavorite(rawProduct)}>
                      {isFavorite(productId) ? "В избранном" : "В избранное"}
                    </button>
                    <Link className="ghost-btn" to={productLink}>
                      К товару
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <aside className="surface cart-summary">
          <h3>Сводка заказа</h3>
          <div className="summary-row">
            <span>Товаров:</span>
            <strong>{totalCount}</strong>
          </div>
          <div className="summary-row">
            <span>Позиций:</span>
            <strong>{items.length}</strong>
          </div>
          <div className="summary-row">
            <span>Скидка:</span>
            <strong>{money.format(0)}</strong>
          </div>
          <div className="summary-row summary-total">
            <span>Итого:</span>
            <strong>{money.format(total)}</strong>
          </div>
          <Link className="checkout-btn" to="/checkout">
            Перейти к оформлению
          </Link>
        </aside>
      </div>

      <div className="cart-extra-grid">
        <article className="surface">
          <h3>Доставка</h3>
          <p className="muted">Курьерская доставка по городу и отправка по СНГ транспортными компаниями.</p>
        </article>
        <article className="surface">
          <h3>Оплата</h3>
          <p className="muted">Безналичный расчет для B2B и оплата картой/наличными для частных клиентов.</p>
        </article>
        <article className="surface">
          <h3>Контакты покупателя</h3>
          <p className="muted">{user ? `${user.name} (${user.email})` : "Авторизуйтесь для автозаполнения данных."}</p>
        </article>
      </div>
    </section>
  );
};

export default CartPage;

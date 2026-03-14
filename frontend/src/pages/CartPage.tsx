import { Link } from "react-router-dom";
import { useCartStore } from "../stores/cartStore";

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const CartPage = () => {
  const { items, total, updateQuantity, removeItem } = useCartStore();

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
            return (
              <article key={`${item.id ?? "guest"}-${productId}`} className="card cart-item">
                <img src={image || "https://dummyimage.com/300x200/e2e8f0/0f172a&text=Part"} alt={title} />
                <div className="cart-item-info">
                  <h3>{title}</h3>
                  <p className="muted">SKU: {item.sku || item.product?.sku}</p>
                  <p className="price">{money.format(unitPrice)}</p>
                  <div className="qty-row">
                    <button type="button" onClick={() => updateQuantity(item.id || productId, Math.max(1, item.quantity - 1))}>
                      -
                    </button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(item.id || productId, Math.min(99, item.quantity + 1))}>
                      +
                    </button>
                    <button type="button" className="ghost-btn" onClick={() => removeItem(item.id || productId)}>
                      Удалить
                    </button>
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
            <strong>{items.length}</strong>
          </div>
          <div className="summary-row">
            <span>Итого:</span>
            <strong>{money.format(total)}</strong>
          </div>
          <Link className="checkout-btn" to="/checkout">
            Оформить заказ
          </Link>
        </aside>
      </div>
    </section>
  );
};

export default CartPage;

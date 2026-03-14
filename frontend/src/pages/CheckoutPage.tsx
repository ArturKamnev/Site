import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { useCartStore } from "../stores/cartStore";

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const CheckoutPage = () => {
  const navigate = useNavigate();
  const cart = useCartStore((state) => state.items);
  const total = useCartStore((state) => state.total);
  const auth = useAuthStore((state) => state.user);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: auth?.email ?? "",
    address: "",
    pickupMethod: "delivery",
    comment: "",
  });
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!cart.length) return;
    setLoading(true);
    try {
      await api.post("/orders", {
        ...form,
        items: cart.map((item) => ({
          productId: item.product_id || item.product?.id,
          quantity: item.quantity,
        })),
      });
      await useCartStore.getState().loadCart();
      navigate("/profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="checkout-page">
      <div className="title-block">
        <h1>Оформление заказа</h1>
        <p>Заполните контактные данные и выберите способ получения.</p>
      </div>

      <div className="checkout-layout">
        <form className="form surface" onSubmit={onSubmit}>
          <input
            required
            placeholder="ФИО"
            value={form.fullName}
            onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
          />
          <input
            required
            placeholder="Телефон"
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
          />
          <input
            required
            placeholder="Email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          <input
            placeholder="Адрес"
            value={form.address}
            onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
          />
          <select
            value={form.pickupMethod}
            onChange={(event) => setForm((prev) => ({ ...prev, pickupMethod: event.target.value }))}
          >
            <option value="delivery">Доставка</option>
            <option value="pickup">Самовывоз</option>
          </select>
          <textarea
            placeholder="Комментарий к заказу"
            value={form.comment}
            onChange={(event) => setForm((prev) => ({ ...prev, comment: event.target.value }))}
          />
          <button type="submit" disabled={loading || !cart.length}>
            {loading ? "Отправка..." : "Подтвердить заказ"}
          </button>
        </form>

        <aside className="surface cart-summary">
          <h3>Ваш заказ</h3>
          <div className="summary-row">
            <span>Позиций:</span>
            <strong>{cart.length}</strong>
          </div>
          <div className="summary-row">
            <span>Сумма:</span>
            <strong>{money.format(total)}</strong>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default CheckoutPage;

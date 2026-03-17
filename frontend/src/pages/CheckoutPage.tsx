import { useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { useCartStore } from "../stores/cartStore";

const CheckoutPage = () => {
  const { t, formatMoney } = useI18n();
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
  const [error, setError] = useState("");

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!cart.length) return;
    setError("");
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
    } catch (requestError) {
      if (axios.isAxiosError(requestError)) {
        const payload = requestError.response?.data as
          | { code?: string; availableStock?: number }
          | undefined;
        if (payload?.code === "STOCK_EXCEEDED") {
          setError(t("cart.stockLimitError", { stock: payload.availableStock ?? 0 }));
          return;
        }
      }
      setError(t("errors.generic"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="checkout-page">
      <div className="title-block">
        <h1>{t("checkout.title")}</h1>
        <p>{t("checkout.description")}</p>
      </div>

      <div className="checkout-layout">
        <form className="form surface" onSubmit={onSubmit}>
          <input
            required
            placeholder={t("checkout.fullName")}
            value={form.fullName}
            onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
          />
          <input
            required
            placeholder={t("checkout.phone")}
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
          />
          <input
            required
            placeholder={t("common.email")}
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          <input
            placeholder={t("checkout.address")}
            value={form.address}
            onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
          />
          <select
            value={form.pickupMethod}
            onChange={(event) => setForm((prev) => ({ ...prev, pickupMethod: event.target.value }))}
          >
            <option value="delivery">{t("checkout.pickup.delivery")}</option>
            <option value="pickup">{t("checkout.pickup.pickup")}</option>
          </select>
          <textarea
            placeholder={t("checkout.comment")}
            value={form.comment}
            onChange={(event) => setForm((prev) => ({ ...prev, comment: event.target.value }))}
          />
          <button type="submit" disabled={loading || !cart.length}>
            {loading ? t("checkout.submitting") : t("checkout.submit")}
          </button>
          {error ? <p className="error">{error}</p> : null}
        </form>

        <aside className="surface cart-summary">
          <h3>{t("checkout.orderTitle")}</h3>
          <div className="summary-row">
            <span>{t("checkout.lines")}:</span>
            <strong>{cart.length}</strong>
          </div>
          <div className="summary-row">
            <span>{t("checkout.amount")}:</span>
            <strong>{formatMoney(total)}</strong>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default CheckoutPage;

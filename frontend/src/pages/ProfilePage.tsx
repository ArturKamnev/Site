import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import type { Order } from "../types";

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
});

const ProfilePage = () => {
  const user = useAuthStore((state) => state.user);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    api.get<Order[]>("/orders/my").then((response) => setOrders(response.data));
  }, []);

  return (
    <section className="profile-page">
      <div className="title-block">
        <h1>Личный кабинет</h1>
        <p>
          {user?.name} ({user?.email})
        </p>
      </div>

      <h2>История заказов</h2>
      <div className="orders">
        {orders.map((order) => (
          <article key={order.id} className="surface order-card">
            <div className="order-head">
              <h3>Заказ #{order.id}</h3>
              <span className="meta-chip">{order.status}</span>
            </div>
            <p className="muted">
              {dateFormatter.format(new Date(order.created_at))} | {money.format(order.total)}
            </p>
            <ul>
              {order.items.map((item) => (
                <li key={item.id}>
                  {item.snapshot_name} x {item.quantity}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      {!orders.length ? <p className="empty-state">У вас пока нет оформленных заказов.</p> : null}
    </section>
  );
};

export default ProfilePage;

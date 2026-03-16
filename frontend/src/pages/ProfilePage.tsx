import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { useFavoritesStore } from "../stores/favoritesStore";
import { useRecentlyViewedStore } from "../stores/recentlyViewedStore";
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
  const favorites = useFavoritesStore((state) => state.items);
  const loadFavorites = useFavoritesStore((state) => state.loadFavorites);
  const recentlyViewed = useRecentlyViewedStore((state) => state.items);
  const clearRecentlyViewed = useRecentlyViewedStore((state) => state.clear);

  useEffect(() => {
    Promise.all([api.get<Order[]>("/orders/my"), loadFavorites()]).then(([ordersResponse]) => {
      setOrders(ordersResponse.data);
    });
  }, [loadFavorites]);

  const totalOrders = orders.length;
  const totalSpent = useMemo(
    () => orders.reduce((sum, order) => sum + order.total, 0),
    [orders],
  );

  return (
    <section className="profile-page">
      <div className="profile-layout">
        <aside className="profile-sidebar surface">
          <h2>{user?.name}</h2>
          <p className="muted">{user?.email}</p>
          <span className="meta-chip">{user?.role}</span>

          <nav>
            <a href="#profile-data">Данные профиля</a>
            <a href="#profile-orders">История заказов</a>
            <a href="#profile-favorites">Избранное</a>
            <a href="#profile-recent">Недавно просмотренные</a>
          </nav>

          <div className="sidebar-stats">
            <article>
              <strong>{totalOrders}</strong>
              <span>заказов</span>
            </article>
            <article>
              <strong>{favorites.length}</strong>
              <span>избранных</span>
            </article>
            <article>
              <strong>{money.format(totalSpent)}</strong>
              <span>сумма покупок</span>
            </article>
          </div>
        </aside>

        <div className="profile-main">
          <article id="profile-data" className="surface profile-card">
            <div className="section-head">
              <h2>Данные пользователя</h2>
            </div>
            <div className="profile-info-grid">
              <div>
                <span>Имя</span>
                <strong>{user?.name}</strong>
              </div>
              <div>
                <span>Email</span>
                <strong>{user?.email}</strong>
              </div>
              <div>
                <span>Роль</span>
                <strong>{user?.role}</strong>
              </div>
              <div>
                <span>Настройки</span>
                <strong>Редактирование профиля будет доступно в следующем обновлении</strong>
              </div>
            </div>
          </article>

          <article id="profile-orders" className="surface profile-card">
            <div className="section-head">
              <h2>История заказов</h2>
            </div>
            <div className="orders">
              {orders.map((order) => (
                <article key={order.id} className="order-card">
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
          </article>

          <article id="profile-favorites" className="surface profile-card">
            <div className="section-head">
              <h2>Избранное</h2>
              <Link to="/favorites">Открыть полный список</Link>
            </div>
            {!favorites.length ? (
              <p className="empty-state">Вы еще не добавляли товары в избранное.</p>
            ) : (
              <div className="mini-products-grid">
                {favorites.slice(0, 6).map((item) => (
                  <Link key={item.id} to={`/product/${item.slug}`} className="mini-product-card">
                    <img src={item.image || "https://dummyimage.com/200x140/e2e8f0/0f172a&text=Part"} alt={item.name} />
                    <strong>{item.name}</strong>
                    <span>{money.format(item.price)}</span>
                  </Link>
                ))}
              </div>
            )}
          </article>

          <article id="profile-recent" className="surface profile-card">
            <div className="section-head">
              <h2>Недавно просмотренные</h2>
              {recentlyViewed.length ? (
                <button type="button" className="ghost-btn" onClick={clearRecentlyViewed}>
                  Очистить
                </button>
              ) : null}
            </div>
            {!recentlyViewed.length ? (
              <p className="empty-state">Пока нет просмотренных товаров.</p>
            ) : (
              <div className="mini-products-grid">
                {recentlyViewed.map((item) => (
                  <Link key={item.id} to={`/product/${item.slug}`} className="mini-product-card">
                    <img src={item.image || "https://dummyimage.com/200x140/e2e8f0/0f172a&text=Part"} alt={item.name} />
                    <strong>{item.name}</strong>
                    <span>{money.format(item.price)}</span>
                  </Link>
                ))}
              </div>
            )}
          </article>
        </div>
      </div>
    </section>
  );
};

export default ProfilePage;

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { useFavoritesStore } from "../stores/favoritesStore";
import { useRecentlyViewedStore } from "../stores/recentlyViewedStore";
import type { Order } from "../types";

const ProfilePage = () => {
  const { t, formatMoney, formatDateTime } = useI18n();
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
  const totalSpent = useMemo(() => orders.reduce((sum, order) => sum + order.total, 0), [orders]);
  const getStatusLabel = (status: string) =>
    t(`status.${status.toLowerCase()}`) === `status.${status.toLowerCase()}`
      ? status
      : t(`status.${status.toLowerCase()}`);

  return (
    <section className="profile-page">
      <div className="profile-layout">
        <aside className="profile-sidebar surface">
          <h2>{user?.name}</h2>
          <p className="muted">{user?.email}</p>
          <span className="meta-chip">{user?.role}</span>

          <nav>
            <a href="#profile-data">{t("profile.data")}</a>
            <a href="#profile-orders">{t("profile.orders")}</a>
            <a href="#profile-favorites">{t("profile.favorites")}</a>
            <a href="#profile-recent">{t("profile.recentlyViewed")}</a>
          </nav>

          <div className="sidebar-stats">
            <article>
              <strong>{totalOrders}</strong>
              <span>{t("profile.ordersCount")}</span>
            </article>
            <article>
              <strong>{favorites.length}</strong>
              <span>{t("profile.favoritesCount")}</span>
            </article>
            <article>
              <strong>{formatMoney(totalSpent)}</strong>
              <span>{t("profile.totalSpent")}</span>
            </article>
          </div>
        </aside>

        <div className="profile-main">
          <article id="profile-data" className="surface profile-card">
            <div className="section-head">
              <h2>{t("profile.userData")}</h2>
            </div>
            <div className="profile-info-grid">
              <div>
                <span>{t("profile.name")}</span>
                <strong>{user?.name}</strong>
              </div>
              <div>
                <span>{t("common.email")}</span>
                <strong>{user?.email}</strong>
              </div>
              <div>
                <span>{t("profile.role")}</span>
                <strong>{user?.role}</strong>
              </div>
              <div>
                <span>{t("profile.settings")}</span>
                <strong>{t("profile.settingsHint")}</strong>
              </div>
            </div>
          </article>

          <article id="profile-orders" className="surface profile-card">
            <div className="section-head">
              <h2>{t("profile.orders")}</h2>
            </div>
            <div className="orders">
              {orders.map((order) => (
                <article key={order.id} className="order-card">
                  <div className="order-head">
                    <h3>{t("admin.orderById", { id: order.id })}</h3>
                    <span className="meta-chip">{getStatusLabel(order.status)}</span>
                  </div>
                  <p className="muted">
                    {formatDateTime(order.created_at)} | {formatMoney(order.total)}
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
            {!orders.length ? <p className="empty-state">{t("profile.emptyOrders")}</p> : null}
          </article>

          <article id="profile-favorites" className="surface profile-card">
            <div className="section-head">
              <h2>{t("profile.favorites")}</h2>
              <Link to="/favorites">{t("profile.openAllFavorites")}</Link>
            </div>
            {!favorites.length ? (
              <p className="empty-state">{t("profile.emptyFavorites")}</p>
            ) : (
              <div className="mini-products-grid">
                {favorites.slice(0, 6).map((item) => (
                  <Link key={item.id} to={`/product/${item.slug}`} className="mini-product-card">
                    <img src={item.image || "https://dummyimage.com/200x140/e2e8f0/0f172a&text=Part"} alt={item.name} />
                    <strong>{item.name}</strong>
                    <span>{formatMoney(item.price)}</span>
                  </Link>
                ))}
              </div>
            )}
          </article>

          <article id="profile-recent" className="surface profile-card">
            <div className="section-head">
              <h2>{t("profile.recentlyViewed")}</h2>
              {recentlyViewed.length ? (
                <button type="button" className="ghost-btn" onClick={clearRecentlyViewed}>
                  {t("common.clear")}
                </button>
              ) : null}
            </div>
            {!recentlyViewed.length ? (
              <p className="empty-state">{t("profile.emptyRecent")}</p>
            ) : (
              <div className="mini-products-grid">
                {recentlyViewed.map((item) => (
                  <Link key={item.id} to={`/product/${item.slug}`} className="mini-product-card">
                    <img src={item.image || "https://dummyimage.com/200x140/e2e8f0/0f172a&text=Part"} alt={item.name} />
                    <strong>{item.name}</strong>
                    <span>{formatMoney(item.price)}</span>
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

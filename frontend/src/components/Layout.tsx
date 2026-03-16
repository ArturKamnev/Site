import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useCartStore } from "../stores/cartStore";
import { useFavoritesStore } from "../stores/favoritesStore";

const routeLabels: Record<string, string> = {
  brands: "Бренды",
  brand: "Бренд",
  products: "Товары",
  product: "Товар",
  cart: "Корзина",
  favorites: "Избранное",
  checkout: "Оформление заказа",
  login: "Вход",
  register: "Регистрация",
  profile: "Профиль",
  admin: "Админка",
};

const formatBreadcrumbLabel = (segment: string) => {
  const normalized = decodeURIComponent(segment);
  return routeLabels[normalized] ?? normalized.replace(/-/g, " ");
};

const Layout = () => {
  const { user, logout } = useAuthStore();
  const loadCart = useCartStore((state) => state.loadCart);
  const cartItems = useCartStore((state) => state.items);
  const loadFavorites = useFavoritesStore((state) => state.loadFavorites);
  const favorites = useFavoritesStore((state) => state.items);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const segments = location.pathname.split("/").filter(Boolean);
  const breadcrumbs = useMemo(
    () =>
      segments.map((segment, index) => ({
        segment,
        href: `/${segments.slice(0, index + 1).join("/")}`,
        isCurrent: index === segments.length - 1,
      })),
    [segments],
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchQuery(params.get("search") ?? "");
  }, [location.search]);

  const onSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = searchQuery.trim();
    navigate(trimmed ? `/brands?search=${encodeURIComponent(trimmed)}` : "/brands");
  };

  const onLogout = () => {
    logout();
    Promise.all([loadCart(), loadFavorites()]);
    navigate("/");
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="main-header">
          <div className="container main-header-inner">
            <Link to="/" className="brand-title">
              <span className="brand-title-mark">TP</span>
              <span>
                Truck Parts
                <small>Marketplace автозапчастей</small>
              </span>
            </Link>

            <NavLink to="/brands" className="catalog-btn">
              Каталог
            </NavLink>

            <form className="header-search" onSubmit={onSearchSubmit}>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Поиск по бренду, SKU или артикулу"
                aria-label="Поиск запчастей"
              />
              <button type="submit">Найти</button>
            </form>

            <nav className="header-actions">
              {user ? (
                <NavLink to="/profile" className="header-action-link">
                  Профиль
                </NavLink>
              ) : (
                <NavLink to="/login" className="header-action-link">
                  Вход
                </NavLink>
              )}

              <NavLink to="/favorites" className="header-action-link">
                Избранное
                <span className="counter">{favorites.length}</span>
              </NavLink>

              <NavLink to="/cart" className="header-action-link">
                Корзина
                <span className="counter">{cartItems.length}</span>
              </NavLink>

              {user && (user.role === "admin" || user.role === "employee") ? (
                <NavLink to="/admin" className="header-action-link">
                  Админка
                </NavLink>
              ) : null}

              {user ? (
                <button type="button" className="link-btn" onClick={onLogout}>
                  Выйти
                </button>
              ) : null}
            </nav>
          </div>
        </div>

        <nav className="section-nav">
          <div className="container section-nav-inner">
            <NavLink to="/">Главная</NavLink>
            <NavLink to="/brands">Бренды</NavLink>
            <NavLink to="/favorites">Избранное</NavLink>
            <NavLink to="/cart">Корзина</NavLink>
            <NavLink to="/profile">Личный кабинет</NavLink>
          </div>
        </nav>
      </header>

      <main className="content">
        <div className="container">
          <div className="breadcrumbs">
            <Link to="/">Главная</Link>
            {breadcrumbs.map((crumb) => (
              <span key={crumb.href}>
                <span className="breadcrumbs-separator">/</span>
                {crumb.isCurrent ? (
                  <span>{formatBreadcrumbLabel(crumb.segment)}</span>
                ) : (
                  <Link to={crumb.href}>{formatBreadcrumbLabel(crumb.segment)}</Link>
                )}
              </span>
            ))}
          </div>
          <Outlet />
        </div>
      </main>

      <footer className="site-footer">
        <div className="container site-footer-inner">
          <div>
            <h4>Truck Parts Store</h4>
            <p>Интернет-магазин запчастей для грузовой техники, сервисных парков и дилеров.</p>
          </div>
          <div>
            <h5>Навигация</h5>
            <div className="footer-links">
              <Link to="/brands">Каталог брендов</Link>
              <Link to="/favorites">Избранное</Link>
              <Link to="/cart">Корзина</Link>
              <Link to="/profile">Профиль</Link>
            </div>
          </div>
          <div>
            <h5>Контакты</h5>
            <p>+996 (700) 123-456</p>
            <p>support@truckparts.local</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;

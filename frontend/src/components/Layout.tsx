import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import companyLogo from "../assets/company-logo.png";
import { useI18n } from "../i18n/I18nProvider";
import { useAuthStore } from "../stores/authStore";
import { useCartStore } from "../stores/cartStore";
import { useFavoritesStore } from "../stores/favoritesStore";
import { useTheme } from "../theme/ThemeProvider";

const routeLabels: Record<string, string> = {
  brands: "common.brands",
  brand: "common.brand",
  products: "common.products",
  product: "common.product",
  cart: "common.cart",
  favorites: "common.favorites",
  checkout: "common.checkout",
  login: "common.login",
  register: "common.register",
  profile: "common.profile",
  admin: "common.admin",
};

const formatBreadcrumbLabel = (segment: string, t: (key: string) => string) => {
  const normalized = decodeURIComponent(segment);
  const labelKey = routeLabels[normalized];
  return labelKey ? t(labelKey) : normalized.replace(/-/g, " ");
};

const SunIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 3.25V5.5M12 18.5v2.25M5.81 5.81 7.4 7.4M16.6 16.6l1.59 1.59M3.25 12H5.5M18.5 12h2.25M5.81 18.19 7.4 16.6M16.6 7.4l1.59-1.59M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M15.25 3.75A8.75 8.75 0 1 0 20.25 16 6.75 6.75 0 1 1 15.25 3.75Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </svg>
);

const HeartIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 20.5 4.8 13.64a4.76 4.76 0 0 1 6.72-6.76L12 7.34l.48-.46a4.76 4.76 0 0 1 6.72 6.76L12 20.5Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </svg>
);

const CartIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M3.5 5.5h2.22c.36 0 .67.25.75.6l.39 1.78m0 0h11.52c.52 0 .89.5.75 1L17.6 14.5a.77.77 0 0 1-.75.6H9.4a.77.77 0 0 1-.75-.6L6.86 7.88Zm2.28 10.62a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Zm8.35 0a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </svg>
);

const MenuIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4 7h16M4 12h16M4 17h16"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </svg>
);

const Layout = () => {
  const { language, setLanguage, t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuthStore();
  const loadCart = useCartStore((state) => state.loadCart);
  const cartItems = useCartStore((state) => state.items);
  const loadFavorites = useFavoritesStore((state) => state.loadFavorites);
  const favorites = useFavoritesStore((state) => state.items);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isPrivilegedUser = Boolean(user && (user.role === "admin" || user.role === "employee"));

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

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

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

  const themeToggleLabel =
    language === "ru"
      ? theme === "dark"
        ? "Переключить на светлую тему"
        : "Переключить на темную тему"
      : theme === "dark"
        ? "Switch to light theme"
        : "Switch to dark theme";

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="main-header">
          <div className="container main-header-inner">
            <div className="header-left">
              <Link to="/" className="brand-title">
                <span className="brand-logo-shell" aria-hidden="true">
                  <img src={companyLogo} alt="" className="brand-logo" />
                </span>
                <span>
                  {t("layout.brandName")}
                  <small>{t("layout.brandTagline")}</small>
                </span>
              </Link>

              <NavLink to="/brands" className="catalog-btn desktop-only">
                {t("layout.catalog")}
              </NavLink>
            </div>

            <form className="header-search desktop-only" onSubmit={onSearchSubmit}>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("layout.searchPlaceholder")}
                aria-label={t("layout.searchAria")}
              />
              <button type="submit">{t("common.search")}</button>
            </form>

            <nav className="header-actions desktop-only">
              {user ? (
                <NavLink to="/profile" className="header-action-link">
                  {t("common.profile")}
                </NavLink>
              ) : (
                <NavLink to="/login" className="header-action-link">
                  {t("common.login")}
                </NavLink>
              )}

              <NavLink to="/favorites" className="header-action-link">
                {t("common.favorites")}
                <span className="counter">{favorites.length}</span>
              </NavLink>

              <NavLink to="/cart" className="header-action-link">
                {t("common.cart")}
                <span className="counter">{cartItems.length}</span>
              </NavLink>

              {isPrivilegedUser ? (
                <NavLink to="/admin" className="header-action-link">
                  {t("common.admin")}
                </NavLink>
              ) : null}

              {user ? (
                <button type="button" className="link-btn" onClick={onLogout}>
                  {t("common.logout")}
                </button>
              ) : null}

              <div className="language-switch" role="group" aria-label={t("common.language")}>
                <button
                  type="button"
                  className={`language-btn ${language === "en" ? "active" : ""}`}
                  onClick={() => setLanguage("en")}
                >
                  EN
                </button>
                <button
                  type="button"
                  className={`language-btn ${language === "ru" ? "active" : ""}`}
                  onClick={() => setLanguage("ru")}
                >
                  RU
                </button>
              </div>

              <button
                type="button"
                className={`theme-toggle ${theme === "dark" ? "is-dark" : "is-light"}`}
                onClick={toggleTheme}
                aria-label={themeToggleLabel}
                title={themeToggleLabel}
              >
                <span className="theme-toggle-track">
                  <span className="theme-icon sun-icon">
                    <SunIcon />
                  </span>
                  <span className="theme-icon moon-icon">
                    <MoonIcon />
                  </span>
                </span>
              </button>
            </nav>

            <div className="mobile-actions">
              <button
                type="button"
                className={`mobile-icon-btn language-chip ${language === "en" ? "active" : ""}`}
                onClick={() => setLanguage(language === "en" ? "ru" : "en")}
                aria-label={t("common.language")}
              >
                {language.toUpperCase()}
              </button>
              <button
                type="button"
                className={`mobile-icon-btn theme-toggle-mobile ${theme === "dark" ? "is-dark" : "is-light"}`}
                onClick={toggleTheme}
                aria-label={themeToggleLabel}
                title={themeToggleLabel}
              >
                {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              </button>
              <NavLink to="/favorites" className="mobile-icon-btn" aria-label={t("common.favorites")}>
                <HeartIcon />
                <span className="counter">{favorites.length}</span>
              </NavLink>
              <NavLink to="/cart" className="mobile-icon-btn" aria-label={t("common.cart")}>
                <CartIcon />
                <span className="counter">{cartItems.length}</span>
              </NavLink>
              <button
                type="button"
                className="mobile-icon-btn burger-btn"
                aria-label={t("layout.openMenu")}
                onClick={() => setMobileMenuOpen(true)}
              >
                <MenuIcon />
              </button>
            </div>
          </div>

          <div className="container mobile-search-row">
            <form className="header-search" onSubmit={onSearchSubmit}>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("layout.searchPlaceholder")}
                aria-label={t("layout.searchAria")}
              />
              <button type="submit">{t("common.search")}</button>
            </form>
          </div>
        </div>

        <div
          className={`mobile-drawer-overlay ${mobileMenuOpen ? "open" : ""}`}
          onClick={() => setMobileMenuOpen(false)}
        />
        <aside className={`mobile-drawer ${mobileMenuOpen ? "open" : ""}`}>
          <div className="mobile-drawer-head">
            <strong>{t("layout.mobileMenuTitle")}</strong>
            <div className="mobile-drawer-tools">
              <button
                type="button"
                className={`mobile-icon-btn theme-toggle-mobile ${theme === "dark" ? "is-dark" : "is-light"}`}
                onClick={toggleTheme}
                aria-label={themeToggleLabel}
                title={themeToggleLabel}
              >
                {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              </button>
              <button
                type="button"
                className="mobile-icon-btn"
                aria-label={t("common.close")}
                onClick={() => setMobileMenuOpen(false)}
              >
                &times;
              </button>
            </div>
          </div>

          <div className="mobile-language-row">
            <button
              type="button"
              className={`language-btn ${language === "en" ? "active" : ""}`}
              onClick={() => setLanguage("en")}
            >
              {t("common.english")}
            </button>
            <button
              type="button"
              className={`language-btn ${language === "ru" ? "active" : ""}`}
              onClick={() => setLanguage("ru")}
            >
              {t("common.russian")}
            </button>
          </div>

          <form className="mobile-search" onSubmit={onSearchSubmit}>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("layout.searchPlaceholder")}
            />
            <button type="submit">{t("common.search")}</button>
          </form>

          <nav className="mobile-nav-links">
            <NavLink to="/">{t("common.home")}</NavLink>
            <NavLink to="/brands">{t("common.brands")}</NavLink>
            <NavLink to="/favorites">{t("common.favorites")}</NavLink>
            <NavLink to="/cart">{t("common.cart")}</NavLink>
            <NavLink to="/profile">{t("common.profile")}</NavLink>
            {isPrivilegedUser ? <NavLink to="/admin">{t("common.admin")}</NavLink> : null}
            {!user ? <NavLink to="/login">{t("common.login")}</NavLink> : null}
            {!user ? <NavLink to="/register">{t("common.register")}</NavLink> : null}
          </nav>

          {user ? (
            <button type="button" className="danger" onClick={onLogout}>
              {t("common.logout")}
            </button>
          ) : null}
        </aside>
      </header>

      <main className="content">
        <div className="container">
          <div className="breadcrumbs">
            <Link to="/">{t("common.home")}</Link>
            {breadcrumbs.map((crumb) => (
              <span key={crumb.href}>
                <span className="breadcrumbs-separator">/</span>
                {crumb.isCurrent ? (
                  <span>{formatBreadcrumbLabel(crumb.segment, t)}</span>
                ) : (
                  <Link to={crumb.href}>{formatBreadcrumbLabel(crumb.segment, t)}</Link>
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
            <h4>{t("layout.footerTitle")}</h4>
            <p>{t("layout.footerDescription")}</p>
          </div>
          <div>
            <h5>{t("layout.footerNavigation")}</h5>
            <div className="footer-links">
              <Link to="/brands">{t("common.brands")}</Link>
              <Link to="/favorites">{t("common.favorites")}</Link>
              <Link to="/cart">{t("common.cart")}</Link>
              <Link to="/profile">{t("common.profile")}</Link>
            </div>
          </div>
          <div>
            <h5>{t("layout.footerContacts")}</h5>
            <p>Главный номер - 0508 109 109</p>
            <p>info@truckparts.kg</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useCartStore } from "../stores/cartStore";
import { useFavoritesStore } from "../stores/favoritesStore";

const routeLabels: Record<string, string> = {
  brands: "Brands",
  brand: "Brand",
  products: "Products",
  product: "Product",
  cart: "Cart",
  favorites: "Favorites",
  checkout: "Checkout",
  login: "Login",
  register: "Register",
  profile: "Profile",
  admin: "Admin",
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="main-header">
          <div className="container main-header-inner">
            <div className="mobile-header-row">
              <Link to="/" className="brand-title">
                <span className="brand-title-mark">TP</span>
                <span>
                  Truck Parts
                  <small>Auto parts marketplace</small>
                </span>
              </Link>

              <div className="mobile-actions">
                <NavLink to="/favorites" className="mobile-icon-btn" aria-label="Favorites">
                  F
                  <span className="counter">{favorites.length}</span>
                </NavLink>
                <NavLink to="/cart" className="mobile-icon-btn" aria-label="Cart">
                  C
                  <span className="counter">{cartItems.length}</span>
                </NavLink>
                <button
                  type="button"
                  className="mobile-icon-btn burger-btn"
                  aria-label="Open menu"
                  onClick={() => setMobileMenuOpen(true)}
                >
                  ≡
                </button>
              </div>
            </div>

            <NavLink to="/brands" className="catalog-btn desktop-only">
              Catalog
            </NavLink>

            <form className="header-search desktop-only" onSubmit={onSearchSubmit}>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by brand, SKU, article"
                aria-label="Search parts"
              />
              <button type="submit">Search</button>
            </form>

            <nav className="header-actions desktop-only">
              {user ? (
                <NavLink to="/profile" className="header-action-link">
                  Profile
                </NavLink>
              ) : (
                <NavLink to="/login" className="header-action-link">
                  Login
                </NavLink>
              )}

              <NavLink to="/favorites" className="header-action-link">
                Favorites
                <span className="counter">{favorites.length}</span>
              </NavLink>

              <NavLink to="/cart" className="header-action-link">
                Cart
                <span className="counter">{cartItems.length}</span>
              </NavLink>

              {user && (user.role === "admin" || user.role === "employee") ? (
                <NavLink to="/admin" className="header-action-link">
                  Admin
                </NavLink>
              ) : null}

              {user ? (
                <button type="button" className="link-btn" onClick={onLogout}>
                  Logout
                </button>
              ) : null}
            </nav>
          </div>
        </div>

        <nav className="section-nav desktop-only">
          <div className="container section-nav-inner">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/brands">Brands</NavLink>
            <NavLink to="/favorites">Favorites</NavLink>
            <NavLink to="/cart">Cart</NavLink>
            <NavLink to="/profile">Profile</NavLink>
          </div>
        </nav>

        <div
          className={`mobile-drawer-overlay ${mobileMenuOpen ? "open" : ""}`}
          onClick={() => setMobileMenuOpen(false)}
        />
        <aside className={`mobile-drawer ${mobileMenuOpen ? "open" : ""}`}>
          <div className="mobile-drawer-head">
            <strong>Menu</strong>
            <button type="button" className="mobile-icon-btn" onClick={() => setMobileMenuOpen(false)}>
              x
            </button>
          </div>

          <form className="mobile-search" onSubmit={onSearchSubmit}>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by brand, SKU, article"
            />
            <button type="submit">Search</button>
          </form>

          <nav className="mobile-nav-links">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/brands">Brands</NavLink>
            <NavLink to="/favorites">Favorites</NavLink>
            <NavLink to="/cart">Cart</NavLink>
            <NavLink to="/profile">Profile</NavLink>
            {user && (user.role === "admin" || user.role === "employee") ? <NavLink to="/admin">Admin</NavLink> : null}
            {!user ? <NavLink to="/login">Login</NavLink> : null}
            {!user ? <NavLink to="/register">Register</NavLink> : null}
          </nav>

          {user ? (
            <button type="button" className="danger" onClick={onLogout}>
              Logout
            </button>
          ) : null}
        </aside>
      </header>

      <main className="content">
        <div className="container">
          <div className="breadcrumbs">
            <Link to="/">Home</Link>
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
            <p>Parts for commercial vehicles, workshops, and fleet operators.</p>
          </div>
          <div>
            <h5>Navigation</h5>
            <div className="footer-links">
              <Link to="/brands">Brands</Link>
              <Link to="/favorites">Favorites</Link>
              <Link to="/cart">Cart</Link>
              <Link to="/profile">Profile</Link>
            </div>
          </div>
          <div>
            <h5>Contacts</h5>
            <p>+996 (700) 123-456</p>
            <p>support@truckparts.local</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;

import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminPage from "./pages/AdminPage";
import BrandPage from "./pages/BrandPage";
import BrandsPage from "./pages/BrandsPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import ProductPage from "./pages/ProductPage";
import ProfilePage from "./pages/ProfilePage";
import RegisterPage from "./pages/RegisterPage";
import FavoritesPage from "./pages/FavoritesPage";
import { useAuthStore } from "./stores/authStore";
import { useCartStore } from "./stores/cartStore";
import { useFavoritesStore } from "./stores/favoritesStore";

const AppBootstrap = () => {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const loadCart = useCartStore((state) => state.loadCart);
  const syncGuestToServer = useCartStore((state) => state.syncGuestToServer);
  const loadFavorites = useFavoritesStore((state) => state.loadFavorites);
  const syncFavoritesToServer = useFavoritesStore((state) => state.syncGuestToServer);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    bootstrap().then(async () => {
      await Promise.all([loadCart(), loadFavorites()]);
    });
  }, [bootstrap, loadCart, loadFavorites]);

  useEffect(() => {
    if (token) {
      Promise.all([syncGuestToServer(), syncFavoritesToServer()]);
    }
  }, [token, syncGuestToServer, syncFavoritesToServer]);

  return null;
};

function App() {
  return (
    <BrowserRouter>
      <AppBootstrap />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="brands" element={<BrandsPage />} />
          <Route path="brands/:slug" element={<BrandPage />} />
          <Route path="brand/:slug" element={<BrandPage />} />
          <Route path="products/:slug" element={<ProductPage />} />
          <Route path="product/:slug" element={<ProductPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="favorites" element={<FavoritesPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route
            path="profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin"
            element={
              <ProtectedRoute roles={["admin", "employee"]}>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

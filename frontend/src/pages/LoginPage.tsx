import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { useCartStore } from "../stores/cartStore";
import { useFavoritesStore } from "../stores/favoritesStore";
import type { User } from "../types";

const LoginPage = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const { data } = await api.post<{ token: string; user: User }>("/auth/login", { email, password });
      setAuth(data.token, data.user);
      await Promise.all([
        useCartStore.getState().syncGuestToServer(),
        useFavoritesStore.getState().syncGuestToServer(),
      ]);
      navigate("/");
    } catch {
      setError("Неверный логин или пароль");
    }
  };

  return (
    <section className="auth-wrap">
      <div className="surface auth-card">
        <h1>Вход</h1>
        <p className="muted">Войдите в аккаунт, чтобы управлять заказами и профилем.</p>
        <form className="form" onSubmit={onSubmit}>
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Пароль"
            type="password"
          />
          {error ? <p className="error">{error}</p> : null}
          <button type="submit">Войти</button>
        </form>
        <p>
          Нет аккаунта? <Link to="/register">Регистрация</Link>
        </p>
      </div>
    </section>
  );
};

export default LoginPage;

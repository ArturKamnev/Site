import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { useCartStore } from "../stores/cartStore";
import { useFavoritesStore } from "../stores/favoritesStore";
import type { User } from "../types";

const RegisterPage = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const { data } = await api.post<{ token: string; user: User }>("/auth/register", form);
      setAuth(data.token, data.user);
      await Promise.all([
        useCartStore.getState().syncGuestToServer(),
        useFavoritesStore.getState().syncGuestToServer(),
      ]);
      navigate("/");
    } catch {
      setError("Ошибка регистрации");
    }
  };

  return (
    <section className="auth-wrap">
      <div className="surface auth-card">
        <h1>Регистрация</h1>
        <p className="muted">Создайте аккаунт для быстрого оформления и отслеживания заказов.</p>
        <form className="form" onSubmit={onSubmit}>
          <input
            placeholder="Имя"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <input
            placeholder="Email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          <input
            placeholder="Пароль"
            type="password"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
          />
          <input
            placeholder="Подтверждение пароля"
            type="password"
            value={form.confirmPassword}
            onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
          />
          {error ? <p className="error">{error}</p> : null}
          <button type="submit">Создать аккаунт</button>
        </form>
        <p>
          Уже зарегистрированы? <Link to="/login">Вход</Link>
        </p>
      </div>
    </section>
  );
};

export default RegisterPage;

import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";
import { useCartStore } from "../stores/cartStore";
import { useFavoritesStore } from "../stores/favoritesStore";
import type { User } from "../types";

const RegisterPage = () => {
  const { t } = useI18n();
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
      setError(t("register.errorFailed"));
    }
  };

  return (
    <section className="auth-wrap">
      <div className="surface auth-card">
        <h1>{t("register.title")}</h1>
        <p className="muted">{t("register.description")}</p>
        <form className="form" onSubmit={onSubmit}>
          <input
            placeholder={t("register.name")}
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <input
            placeholder={t("common.email")}
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          <input
            placeholder={t("register.password")}
            type="password"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
          />
          <input
            placeholder={t("register.confirmPassword")}
            type="password"
            value={form.confirmPassword}
            onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
          />
          {error ? <p className="error">{error}</p> : null}
          <button type="submit">{t("register.submit")}</button>
        </form>
        <p>
          {t("register.hasAccount")} <Link to="/login">{t("register.goLogin")}</Link>
        </p>
      </div>
    </section>
  );
};

export default RegisterPage;

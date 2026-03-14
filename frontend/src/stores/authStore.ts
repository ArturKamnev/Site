import { create } from "zustand";
import { api, setAuthToken } from "../lib/api";
import type { User } from "../types";

type AuthState = {
  token: string | null;
  user: User | null;
  initialized: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  bootstrap: () => Promise<void>;
};

const TOKEN_KEY = "parts_auth_token";
const USER_KEY = "parts_auth_user";

const getSavedUser = () => {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem(TOKEN_KEY),
  user: getSavedUser(),
  initialized: false,
  setAuth: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setAuthToken(token);
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setAuthToken(null);
    set({ token: null, user: null });
  },
  bootstrap: async () => {
    if (get().initialized) return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      set({ initialized: true });
      return;
    }
    setAuthToken(token);
    try {
      const { data } = await api.get<User>("/auth/me");
      get().setAuth(token, data);
    } catch {
      get().logout();
    } finally {
      set({ initialized: true });
    }
  },
}));

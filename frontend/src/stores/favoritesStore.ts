import { create } from "zustand";
import { api } from "../lib/api";
import { useAuthStore } from "./authStore";
import type { FavoriteItem, Product } from "../types";

type GuestFavorite = {
  productId: number;
  product: Product;
  createdAt: string;
};

type FavoritesState = {
  items: FavoriteItem[];
  hydrated: boolean;
  loadFavorites: () => Promise<void>;
  toggleFavorite: (product: Product) => Promise<void>;
  removeFavorite: (productId: number) => Promise<void>;
  isFavorite: (productId: number) => boolean;
  syncGuestToServer: () => Promise<void>;
};

const GUEST_FAVORITES_KEY = "parts_guest_favorites";

const loadGuestFavorites = (): GuestFavorite[] => {
  const raw = localStorage.getItem(GUEST_FAVORITES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as GuestFavorite[];
  } catch {
    return [];
  }
};

const saveGuestFavorites = (items: GuestFavorite[]) => {
  localStorage.setItem(GUEST_FAVORITES_KEY, JSON.stringify(items));
};

const normalizeServerItem = (item: FavoriteItem): FavoriteItem => ({
  ...item,
  id: item.id ?? item.productId,
});

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  items: [],
  hydrated: false,
  loadFavorites: async () => {
    const token = useAuthStore.getState().token;
    if (token) {
      const { data } = await api.get<{ items: FavoriteItem[] }>("/favorites");
      set({ items: data.items.map(normalizeServerItem), hydrated: true });
      return;
    }

    const guest = loadGuestFavorites();
    const items = guest.map((entry) => ({
      ...entry.product,
      productId: entry.productId,
      createdAt: entry.createdAt,
    }));
    set({ items, hydrated: true });
  },
  toggleFavorite: async (product) => {
    const token = useAuthStore.getState().token;
    const favorite = get().isFavorite(product.id);

    if (token) {
      if (favorite) {
        await api.delete(`/favorites/items/${product.id}`);
      } else {
        await api.post("/favorites/items", { productId: product.id });
      }
      await get().loadFavorites();
      return;
    }

    const guest = loadGuestFavorites();
    if (favorite) {
      saveGuestFavorites(guest.filter((entry) => entry.productId !== product.id));
    } else {
      const deduped = guest.filter((entry) => entry.productId !== product.id);
      deduped.unshift({ productId: product.id, product, createdAt: new Date().toISOString() });
      saveGuestFavorites(deduped.slice(0, 40));
    }
    await get().loadFavorites();
  },
  removeFavorite: async (productId) => {
    const token = useAuthStore.getState().token;
    if (token) {
      await api.delete(`/favorites/items/${productId}`);
      await get().loadFavorites();
      return;
    }

    const guest = loadGuestFavorites().filter((entry) => entry.productId !== productId);
    saveGuestFavorites(guest);
    await get().loadFavorites();
  },
  isFavorite: (productId) => get().items.some((item) => (item.productId ?? item.id) === productId),
  syncGuestToServer: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    const guest = loadGuestFavorites();
    if (guest.length) {
      await api.post("/favorites/sync", {
        productIds: guest.map((entry) => entry.productId),
      });
      saveGuestFavorites([]);
    }

    await get().loadFavorites();
  },
}));

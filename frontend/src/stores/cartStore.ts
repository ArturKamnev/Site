import { create } from "zustand";
import { api } from "../lib/api";
import { useAuthStore } from "./authStore";
import type { CartItem, Product } from "../types";

type GuestCartItem = {
  productId: number;
  quantity: number;
  product: Product;
};

type CartState = {
  items: CartItem[];
  total: number;
  hydrated: boolean;
  loadCart: () => Promise<void>;
  addItem: (product: Product, quantity?: number) => Promise<void>;
  updateQuantity: (idOrProductId: number, quantity: number) => Promise<void>;
  removeItem: (idOrProductId: number) => Promise<void>;
  syncGuestToServer: () => Promise<void>;
};

const GUEST_KEY = "parts_guest_cart";

const loadGuestCart = (): GuestCartItem[] => {
  const raw = localStorage.getItem(GUEST_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as GuestCartItem[];
  } catch {
    return [];
  }
};

const saveGuestCart = (items: GuestCartItem[]) => {
  localStorage.setItem(GUEST_KEY, JSON.stringify(items));
};

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  total: 0,
  hydrated: false,
  loadCart: async () => {
    const token = useAuthStore.getState().token;
    if (token) {
      const { data } = await api.get("/cart");
      set({ items: data.items, total: data.total, hydrated: true });
      return;
    }

    const guest = loadGuestCart();
    const items: CartItem[] = guest.map((entry) => ({
      product_id: entry.productId,
      quantity: entry.quantity,
      product: entry.product,
    }));
    const total = guest.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    set({ items, total, hydrated: true });
  },
  addItem: async (product, quantity = 1) => {
    const token = useAuthStore.getState().token;
    if (token) {
      await api.post("/cart/items", { productId: product.id, quantity });
      await get().loadCart();
      return;
    }

    const guest = loadGuestCart();
    const existing = guest.find((entry) => entry.productId === product.id);
    if (existing) {
      existing.quantity = Math.min(99, existing.quantity + quantity);
    } else {
      guest.push({ productId: product.id, quantity, product });
    }
    saveGuestCart(guest);
    await get().loadCart();
  },
  updateQuantity: async (idOrProductId, quantity) => {
    const token = useAuthStore.getState().token;
    if (token) {
      await api.patch(`/cart/items/${idOrProductId}`, { quantity });
      await get().loadCart();
      return;
    }

    const guest = loadGuestCart().map((item) =>
      item.productId === idOrProductId ? { ...item, quantity } : item,
    );
    saveGuestCart(guest);
    await get().loadCart();
  },
  removeItem: async (idOrProductId) => {
    const token = useAuthStore.getState().token;
    if (token) {
      await api.delete(`/cart/items/${idOrProductId}`);
      await get().loadCart();
      return;
    }

    const guest = loadGuestCart().filter((item) => item.productId !== idOrProductId);
    saveGuestCart(guest);
    await get().loadCart();
  },
  syncGuestToServer: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    const guest = loadGuestCart();
    if (guest.length) {
      await api.post("/cart/sync", {
        items: guest.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      });
      saveGuestCart([]);
    }
    await get().loadCart();
  },
}));

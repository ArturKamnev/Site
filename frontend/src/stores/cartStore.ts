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

const clampQuantity = (quantity: number, stock: number) => {
  const limit = Math.max(0, Math.min(stock, 99));
  if (limit <= 0) return 0;
  return Math.max(1, Math.min(quantity, limit));
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
    const sanitizedGuest = guest
      .map((entry) => ({
        ...entry,
        quantity: clampQuantity(entry.quantity, entry.product.stock),
      }))
      .filter((entry) => entry.quantity > 0);
    if (sanitizedGuest.length !== guest.length) {
      saveGuestCart(sanitizedGuest);
    }

    const items: CartItem[] = sanitizedGuest.map((entry) => ({
      product_id: entry.productId,
      quantity: entry.quantity,
      product: entry.product,
    }));
    const total = sanitizedGuest.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    set({ items, total, hydrated: true });
  },
  addItem: async (product, quantity = 1) => {
    const token = useAuthStore.getState().token;
    if (token) {
      await api.post("/cart/items", { productId: product.id, quantity });
      await get().loadCart();
      return;
    }

    const normalizedQuantity = clampQuantity(quantity, product.stock);
    if (normalizedQuantity <= 0) {
      return;
    }

    const guest = loadGuestCart();
    const existing = guest.find((entry) => entry.productId === product.id);
    if (existing) {
      existing.quantity = clampQuantity(existing.quantity + normalizedQuantity, product.stock);
    } else {
      guest.push({ productId: product.id, quantity: normalizedQuantity, product });
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
      item.productId === idOrProductId
        ? { ...item, quantity: clampQuantity(quantity, item.product.stock) || item.quantity }
        : item,
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
      const normalizedItems = guest
        .map((item) => ({
          productId: item.productId,
          quantity: clampQuantity(item.quantity, item.product.stock),
        }))
        .filter((item) => item.quantity > 0);

      await api.post("/cart/sync", {
        items: normalizedItems,
      });
      saveGuestCart([]);
    }
    await get().loadCart();
  },
}));

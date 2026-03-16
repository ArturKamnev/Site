import { create } from "zustand";
import type { Product } from "../types";

type RecentlyViewedState = {
  items: Product[];
  addItem: (product: Product) => void;
  clear: () => void;
};

const RECENTLY_VIEWED_KEY = "parts_recently_viewed";
const MAX_RECENTLY_VIEWED = 12;

const loadItems = (): Product[] => {
  const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Product[];
  } catch {
    return [];
  }
};

const saveItems = (items: Product[]) => {
  localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(items));
};

export const useRecentlyViewedStore = create<RecentlyViewedState>((set) => ({
  items: loadItems(),
  addItem: (product) => {
    set((state) => {
      const deduped = state.items.filter((entry) => entry.id !== product.id);
      const next = [product, ...deduped].slice(0, MAX_RECENTLY_VIEWED);
      saveItems(next);
      return { items: next };
    });
  },
  clear: () => {
    saveItems([]);
    set({ items: [] });
  },
}));

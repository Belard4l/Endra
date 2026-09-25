import { create } from "zustand";
import { persist } from "zustand/middleware";

export type BasketItem = {
  key: string;
  serviceId: string;
  slug: string;
  title: string;
  image?: string;
  category: string;
  sellerId: string;
  shopName?: string;
  eventDate: string;
  startTime: string;
  selections: { groupId: string; choiceIds: string[] }[];
  selectionLabels: string[];
  price: number; // estimate shown to the couple; the server recalculates
  notes?: string;
};

export type SavedService = { id: string; slug: string; title: string; image?: string; basePrice: number; category: string };

type State = {
  basket: BasketItem[];
  saved: SavedService[];
  addToBasket: (item: Omit<BasketItem, "key">) => void;
  updateItem: (key: string, patch: Partial<BasketItem>) => void;
  removeFromBasket: (key: string) => void;
  clearBasket: () => void;
  toggleSaved: (s: SavedService) => boolean;
  isSaved: (id: string) => boolean;
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      basket: [],
      saved: [],
      addToBasket: (item) =>
        set((s) => ({
          basket: [
            // One entry per service per date — adding again replaces it
            ...s.basket.filter((b) => !(b.serviceId === item.serviceId && b.eventDate === item.eventDate)),
            { ...item, key: `${item.serviceId}-${item.eventDate}-${Date.now()}` },
          ],
        })),
      updateItem: (key, patch) => set((s) => ({ basket: s.basket.map((b) => (b.key === key ? { ...b, ...patch } : b)) })),
      removeFromBasket: (key) => set((s) => ({ basket: s.basket.filter((b) => b.key !== key) })),
      clearBasket: () => set({ basket: [] }),
      toggleSaved: (svc) => {
        const exists = get().saved.some((x) => x.id === svc.id);
        set((s) => ({ saved: exists ? s.saved.filter((x) => x.id !== svc.id) : [svc, ...s.saved] }));
        return !exists;
      },
      isSaved: (id) => get().saved.some((x) => x.id === id),
    }),
    { name: "huza-store" }
  )
);

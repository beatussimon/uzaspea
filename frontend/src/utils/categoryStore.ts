type Listener = () => void;

let optimisticCategory: string | null = null;
let optimisticSubcategory: string | null = null;
const listeners = new Set<Listener>();

export const categoryStore = {
  getCategory: () => optimisticCategory,
  getSubcategory: () => optimisticSubcategory,
  setCategory: (category: string | null, subcategory: string | null = null) => {
    optimisticCategory = category;
    optimisticSubcategory = subcategory;
    listeners.forEach((listener) => listener());
  },
  resetIfMatches: (categoryParam: string, subcategoryParam: string) => {
    if (
      optimisticCategory !== null &&
      (optimisticCategory || '') === (categoryParam || '') &&
      (optimisticSubcategory === null || (optimisticSubcategory || '') === (subcategoryParam || ''))
    ) {
      optimisticCategory = null;
      optimisticSubcategory = null;
      listeners.forEach((listener) => listener());
    }
  },
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

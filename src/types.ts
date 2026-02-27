export type Category = 'head' | 'torso' | 'legs' | 'shoes';

export const CATEGORIES: Category[] = ['head', 'torso', 'legs', 'shoes'];

export const CATEGORY_LABELS: Record<Category, string> = {
  head: 'Head',
  torso: 'Torso',
  legs: 'Legs',
  shoes: 'Shoes',
};

export interface ClothingItem {
  id: string;
  name: string;
  category: Category;
  imageData: string; // base64 data URL (transparent PNG after bg removal)
  createdAt: number;
}

export type Outfit = Record<Category, string | null>; // category -> item id

export const EMPTY_OUTFIT: Outfit = {
  head: null,
  torso: null,
  legs: null,
  shoes: null,
};

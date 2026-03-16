export type Role = "user" | "admin" | "employee";

export type User = {
  id: number;
  name: string;
  email: string;
  role: Role;
};

export type Brand = {
  id: number;
  name: string;
  slug: string;
  logo_url?: string | null;
  description?: string | null;
  productsCount?: number;
};

export type Category = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  productsCount?: number;
};

export type Product = {
  id: number;
  name: string;
  slug: string;
  sku: string;
  article?: string | null;
  part_id?: string | null;
  price: number;
  old_price?: number | null;
  discount_percent?: number | null;
  image?: string | null;
  description?: string | null;
  manufacturer?: string | null;
  stock: number;
  is_available: number;
  brand_id?: number;
  category_id?: number;
  brandName?: string;
  brandSlug?: string;
  categoryName?: string;
  categorySlug?: string;
};

export type FavoriteItem = Product & {
  favoriteId?: number;
  productId?: number;
  createdAt?: string;
};

export type HeroSlide = {
  id: number;
  position: number;
  label: string;
  image_url: string;
  title?: string | null;
  subtitle?: string | null;
  button_text?: string | null;
  button_link?: string | null;
  is_active: number;
};

export type CartItem = {
  id?: number;
  cart_id?: number;
  product_id?: number;
  quantity: number;
  product?: Product;
  name?: string;
  slug?: string;
  price?: number;
  image?: string;
  sku?: string;
  stock?: number;
  brandName?: string;
  categoryName?: string;
};

export type Order = {
  id: number;
  status: string;
  full_name: string;
  phone: string;
  email: string;
  total: number;
  created_at: string;
  items: Array<{
    id: number;
    product_id?: number | null;
    snapshot_name: string;
    snapshot_sku: string;
    price: number;
    quantity: number;
    line_total: number;
  }>;
};

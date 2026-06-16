import { isAxiosError } from "axios";

import type { AdminPagination } from "../../types";

export const defaultPagination: AdminPagination = {
  total: 0,
  page: 1,
  pageSize: 25,
  totalPages: 1,
};

export const getApiErrorMessage = (error: unknown, fallback: string) =>
  isAxiosError<{ message?: string }>(error) && error.response?.data?.message
    ? error.response.data.message
    : fallback;

export type ProductFormState = {
  name: string;
  sku: string;
  article: string;
  partId: string;
  price: number;
  discountPercent: number;
  image: string;
  description: string;
  manufacturer: string;
  stock: number;
  isAvailable: boolean;
  brandId: number;
  categoryId: number;
  specsJson: string;
};

export const createDefaultProductForm = (brandId = 0, categoryId = 0): ProductFormState => ({
  name: "",
  sku: "",
  article: "",
  partId: "",
  price: 0,
  discountPercent: 0,
  image: "",
  description: "",
  manufacturer: "",
  stock: 0,
  isAvailable: true,
  brandId,
  categoryId,
  specsJson: "",
});

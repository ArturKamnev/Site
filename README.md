# Truck Parts Store (Full-Stack)

Многостраничный интернет-магазин запчастей с frontend, backend, авторизацией, корзиной, оформлением заказа и админ-панелью.

## Стек

- Frontend: React + TypeScript + Vite + React Router + Zustand + Axios
- Backend: Node.js + Express + TypeScript + SQLite (`better-sqlite3`) + JWT + Zod
- База данных: SQLite (`backend/data/shop.db`)

## Реализовано

- Каталог брендов
- Страница бренда с фильтрами/поиском/сортировкой/пагинацией
- Карточка товара
- Корзина:
  - guest: localStorage
  - auth user: backend cart + синхронизация guest -> server после входа
- Регистрация / вход / выход / роли (`user`, `admin`, `employee`)
- Защита роутов
- Оформление заказа
- Профиль с историей заказов
- Админ-панель:
  - dashboard
  - товары (создание/удаление)
  - бренды (создание/удаление)
  - категории (создание/удаление)
  - заказы (изменение статуса)
- Seed-данные:
  - все бренды из ТЗ
  - роли
  - demo пользователи
  - категории
  - demo товары и изображения

## Структура сущностей БД

- `roles`
- `users`
- `brands`
- `categories`
- `products`
- `product_images`
- `carts`
- `cart_items`
- `orders`
- `order_items`

## Запуск

### 1) Backend

```bash
cd backend
cp .env.example .env
npm install
npm run db:seed
npm run dev
```

Backend API: `http://localhost:4000/api`

### 2) Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend: `http://localhost:5173`

## Демо-аккаунты

- Admin: `admin@parts.local` / `admin1234`
- Employee: `employee@parts.local` / `employee1234`
- User: `user@parts.local` / `user12345`

## Ключевые API маршруты

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `GET /brands`
- `GET /brands/:slug/products`
- `GET /products/:slug`
- `GET /cart` (auth)
- `POST /cart/items` (auth)
- `POST /orders`
- `GET /orders/my` (auth)
- `GET /admin/dashboard` (admin/employee)
- `POST /admin/products` (admin/employee)
- `PATCH /admin/orders/:id/status` (admin/employee)

## Подготовка к оплате

Checkout уже выделен отдельным endpoint (`POST /orders`), где можно добавить:

- создание payment intent,
- хранение `payment_status`, `payment_provider`, `transaction_id`,
- webhook-обработчик подтверждения оплаты.

## Примечания

- В проекте используется SQLite для быстрого локального запуска. Для production можно заменить слой `better-sqlite3` на PostgreSQL с сохранением API-контракта.

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { api } from "../lib/api";
import type { Brand, Product } from "../types";

type ProductFeedResponse = {
  items: Product[];
};

const HomePage = () => {
  const [query, setQuery] = useState("");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get<Brand[]>("/brands"),
      api.get<ProductFeedResponse>("/products", { params: { page: 1, pageSize: 8 } }),
    ]).then(([brandsResponse, productsResponse]) => {
      setBrands(brandsResponse.data.slice(0, 8));
      setProducts(productsResponse.data.items);
    });
  }, []);

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/brands?search=${encodeURIComponent(trimmed)}` : "/brands");
  };

  return (
    <section className="home-page">
      <div className="home-hero">
        <div className="hero-content">
          <p className="hero-eyebrow">Профессиональный marketplace запчастей</p>
          <h1>Запчасти для грузового транспорта с быстрым подбором по бренду и артикулу</h1>
          <p>
            Каталог брендов, фильтрация по наличию и производителю, удобная корзина и оформление заказа
            для сервисов, автопарков и частных клиентов.
          </p>
          <form onSubmit={onSearch} className="hero-search">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Например: SAF, WABCO, 230123"
            />
            <button type="submit">Найти запчасти</button>
          </form>
          <div className="hero-actions">
            <Link className="ghost-btn" to="/brands">
              Открыть каталог брендов
            </Link>
            <Link className="ghost-btn" to="/cart">
              Перейти в корзину
            </Link>
          </div>
        </div>
        <div className="hero-side">
          <article>
            <strong>15 000+</strong>
            <span>SKU в актуальном каталоге</span>
          </article>
          <article>
            <strong>120+</strong>
            <span>брендов в наличии</span>
          </article>
          <article>
            <strong>24/7</strong>
            <span>онлайн-доступ к заказам</span>
          </article>
        </div>
      </div>

      <div className="section-head">
        <h2>Популярные бренды</h2>
        <Link to="/brands">Все бренды</Link>
      </div>
      <div className="grid grid-brand">
        {brands.map((brand) => (
          <Link key={brand.id} to={`/brands/${brand.slug}`} className="card brand-card">
            <img src={brand.logo_url || "https://dummyimage.com/320x140/e2e8f0/0f172a&text=Brand"} alt={brand.name} />
            <div className="card-body">
              <h3>{brand.name}</h3>
              <p className="muted">{brand.description || "Оригинальные и совместимые запчасти."}</p>
              <span className="meta-chip">{brand.productsCount || 0} товаров</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="section-head">
        <h2>Популярные товары</h2>
        <Link to="/brands">Смотреть каталог</Link>
      </div>
      <div className="grid grid-products">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      <div className="benefits-grid">
        <article className="benefit-card">
          <h3>Быстрый подбор</h3>
          <p>Поиск по SKU, артикулу, бренду и категории с точной фильтрацией по наличию.</p>
        </article>
        <article className="benefit-card">
          <h3>Прозрачные цены</h3>
          <p>Актуальные цены и остатки в карточке товара без лишних шагов.</p>
        </article>
        <article className="benefit-card">
          <h3>Удобный кабинет</h3>
          <p>История заказов, статус обработки и быстрый повтор покупки из профиля.</p>
        </article>
      </div>
    </section>
  );
};

export default HomePage;

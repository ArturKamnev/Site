import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import heroImage from "../assets/hero.png";
import { api } from "../lib/api";
import { useRecentlyViewedStore } from "../stores/recentlyViewedStore";
import type { Brand, Product } from "../types";

type ProductFeedResponse = {
  items: Product[];
};

const promoSlides = [
  {
    id: "spring-service",
    badge: "Сезонное предложение",
    title: "Комплексные скидки на подвеску и тормозную систему",
    text: "Подбор по бренду и артикулу с быстрой отгрузкой со склада.",
    image: heroImage,
    cta: "/brands",
  },
  {
    id: "fleet-b2b",
    badge: "Для автопарков",
    title: "Персональные условия для сервисов и корпоративных клиентов",
    text: "Заказы партиями, прозрачные остатки и удобное оформление в кабинете.",
    image: "https://dummyimage.com/1280x420/dbeafe/0b2f62&text=Fleet+Supply",
    cta: "/profile",
  },
  {
    id: "oem-brands",
    badge: "Топ-бренды",
    title: "WABCO, SAF, ZF, DAYCO и другие бренды в одном каталоге",
    text: "Сравнивайте позиции, добавляйте в избранное и формируйте корзину за минуты.",
    image: "https://dummyimage.com/1280x420/e0f2fe/0b2f62&text=OEM+Parts",
    cta: "/brands",
  },
];

const HomePage = () => {
  const [query, setQuery] = useState("");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const navigate = useNavigate();
  const recentlyViewed = useRecentlyViewedStore((state) => state.items);

  useEffect(() => {
    Promise.all([
      api.get<Brand[]>("/brands"),
      api.get<ProductFeedResponse>("/products", { params: { page: 1, pageSize: 10 } }),
    ]).then(([brandsResponse, productsResponse]) => {
      setBrands(brandsResponse.data.slice(0, 8));
      setProducts(productsResponse.data.items);
    });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % promoSlides.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, []);

  const currentSlide = useMemo(() => promoSlides[activeSlide], [activeSlide]);

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/brands?search=${encodeURIComponent(trimmed)}` : "/brands");
  };

  const nextSlide = () => {
    setActiveSlide((prev) => (prev + 1) % promoSlides.length);
  };

  const prevSlide = () => {
    setActiveSlide((prev) => (prev - 1 + promoSlides.length) % promoSlides.length);
  };

  return (
    <section className="home-page">
      <div className="promo-strip">
        <span>Бесплатный подбор по VIN и артикулу</span>
        <span>Доставка по СНГ и самовывоз со склада</span>
        <span>Поддержка B2B заказов для автопарков</span>
      </div>

      <article className="hero-carousel">
        <button type="button" className="carousel-arrow left" onClick={prevSlide} aria-label="Предыдущий баннер">
          {"<"}
        </button>

        <div className="hero-slide">
          <img src={currentSlide.image} alt={currentSlide.title} />
          <div className="hero-slide-content">
            <p className="hero-eyebrow">{currentSlide.badge}</p>
            <h1>{currentSlide.title}</h1>
            <p>{currentSlide.text}</p>
            <form onSubmit={onSearch} className="hero-search">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск по бренду, SKU, артикулу"
              />
              <button type="submit">Найти запчасти</button>
            </form>
            <Link className="ghost-btn" to={currentSlide.cta}>
              Смотреть предложения
            </Link>
          </div>
        </div>

        <button type="button" className="carousel-arrow right" onClick={nextSlide} aria-label="Следующий баннер">
          {">"}
        </button>
      </article>

      <div className="carousel-dots">
        {promoSlides.map((slide, index) => (
          <button
            type="button"
            key={slide.id}
            className={index === activeSlide ? "active" : ""}
            onClick={() => setActiveSlide(index)}
            aria-label={`Перейти к слайду ${index + 1}`}
          />
        ))}
      </div>

      <div className="section-head">
        <h2>Популярные товары</h2>
        <Link to="/brands">Смотреть каталог</Link>
      </div>
      <div className="horizontal-scroll">
        {products.map((product) => (
          <div key={product.id} className="horizontal-card">
            <ProductCard product={product} />
          </div>
        ))}
      </div>

      <div className="section-head">
        <h2>Популярные бренды</h2>
        <Link to="/brands">Все бренды</Link>
      </div>
      <div className="grid grid-brand">
        {brands.map((brand) => (
          <Link key={brand.id} to={`/brand/${brand.slug}`} className="card brand-card">
            <img src={brand.logo_url || "https://dummyimage.com/320x140/e2e8f0/0f172a&text=Brand"} alt={brand.name} />
            <div className="card-body">
              <h3>{brand.name}</h3>
              <p className="muted">{brand.description || "Оригинальные и совместимые запчасти."}</p>
              <span className="meta-chip">{brand.productsCount || 0} товаров</span>
            </div>
          </Link>
        ))}
      </div>

      {recentlyViewed.length ? (
        <>
          <div className="section-head">
            <h2>Недавно просмотренные</h2>
            <Link to="/profile">Открыть в профиле</Link>
          </div>
          <div className="horizontal-scroll">
            {recentlyViewed.map((product) => (
              <div key={product.id} className="horizontal-card">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </>
      ) : null}

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
          <h3>Личный кабинет</h3>
          <p>История заказов, избранное и недавно просмотренные товары в одном месте.</p>
        </article>
      </div>
    </section>
  );
};

export default HomePage;

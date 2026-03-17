import { useEffect, useMemo, useState } from "react";
import type { TouchEvent } from "react";
import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import heroImage from "../assets/hero.png";
import { useI18n } from "../i18n/I18nProvider";
import { api } from "../lib/api";
import { useRecentlyViewedStore } from "../stores/recentlyViewedStore";
import type { Brand, HeroSlide, Product } from "../types";

type ProductFeedResponse = {
  items: Product[];
};

const fallbackSlide: HeroSlide = {
  id: 0,
  position: 1,
  label: "",
  image_url: heroImage,
  title: null,
  subtitle: null,
  button_text: null,
  button_link: null,
  is_active: 1,
};

const HomePage = () => {
  const { t } = useI18n();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [canHover, setCanHover] = useState(false);
  const recentlyViewed = useRecentlyViewedStore((state) => state.items);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: hover)");
    const updateHover = () => setCanHover(mediaQuery.matches);
    updateHover();
    mediaQuery.addEventListener("change", updateHover);
    return () => mediaQuery.removeEventListener("change", updateHover);
  }, []);

  useEffect(() => {
    Promise.all([
      api.get<Brand[]>("/brands"),
      api.get<ProductFeedResponse>("/products", { params: { page: 1, pageSize: 10 } }),
      api.get<HeroSlide[]>("/hero-slides"),
    ]).then(([brandsResponse, productsResponse, slidesResponse]) => {
      setBrands(brandsResponse.data.slice(0, 8));
      setProducts(productsResponse.data.items);
      setSlides(slidesResponse.data);
    });
  }, []);

  const visibleSlides = useMemo(() => (slides.length ? slides : [fallbackSlide]), [slides]);
  const currentSlide = visibleSlides[activeSlide] ?? visibleSlides[0];
  const shouldPauseAutoplay = canHover && isHovered;

  useEffect(() => {
    if (visibleSlides.length <= 1 || shouldPauseAutoplay) return;
    const timer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % visibleSlides.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [visibleSlides.length, shouldPauseAutoplay]);

  useEffect(() => {
    if (activeSlide >= visibleSlides.length) {
      setActiveSlide(0);
    }
  }, [activeSlide, visibleSlides.length]);

  const nextSlide = () => {
    setActiveSlide((prev) => (prev + 1) % visibleSlides.length);
  };

  const prevSlide = () => {
    setActiveSlide((prev) => (prev - 1 + visibleSlides.length) % visibleSlides.length);
  };

  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    setTouchStartX(event.changedTouches[0]?.clientX ?? null);
  };
  const onTouchEnd = (event: TouchEvent<HTMLElement>) => {
    if (touchStartX === null) return;
    const diff = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
    if (Math.abs(diff) > 40) {
      if (diff < 0) nextSlide();
      if (diff > 0) prevSlide();
    }
    setTouchStartX(null);
  };

  return (
    <section className="home-page">
      <article
        className="hero-carousel"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <button type="button" className="carousel-arrow left" onClick={prevSlide} aria-label={t("home.slide.prev")}>
          {"<"}
        </button>

        <div className="hero-slide" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <img src={currentSlide.image_url} alt={currentSlide.title || currentSlide.label || t("home.fallbackFeatured")} />
          <div className="hero-slide-content">
            <p className="hero-eyebrow">{currentSlide.label || t("home.fallbackFeatured")}</p>
            {currentSlide.title ? <h1>{currentSlide.title}</h1> : null}
            {currentSlide.subtitle ? <p>{currentSlide.subtitle}</p> : null}
            {currentSlide.button_text && currentSlide.button_link ? (
              <Link className="ghost-btn" to={currentSlide.button_link}>
                {currentSlide.button_text}
              </Link>
            ) : null}
          </div>
        </div>

        <button type="button" className="carousel-arrow right" onClick={nextSlide} aria-label={t("home.slide.next")}>
          {">"}
        </button>
      </article>

      <div className="carousel-dots">
        {visibleSlides.map((slide, index) => (
          <button
            type="button"
            key={slide.id || index}
            className={index === activeSlide ? "active" : ""}
            onClick={() => setActiveSlide(index)}
            aria-label={t("home.slide.goto", { index: index + 1 })}
          />
        ))}
      </div>

      <div className="section-head">
        <h2>{t("home.popularProducts")}</h2>
        <Link to="/brands">{t("home.openCatalog")}</Link>
      </div>
      <div className="horizontal-scroll">
        {products.map((product) => (
          <div key={product.id} className="horizontal-card">
            <ProductCard product={product} />
          </div>
        ))}
      </div>

      <div className="section-head">
        <h2>{t("home.popularBrands")}</h2>
        <Link to="/brands">{t("home.allBrands")}</Link>
      </div>
      <div className="grid grid-brand">
        {brands.map((brand) => (
          <Link key={brand.id} to={`/brand/${brand.slug}`} className="card brand-card">
            <img src={brand.logo_url || "https://dummyimage.com/320x140/e2e8f0/0f172a&text=Brand"} alt={brand.name} />
            <div className="card-body">
              <h3>{brand.name}</h3>
              <p className="muted">{brand.description || t("home.noBrandDescription")}</p>
              <span className="meta-chip">{t("home.productsCount", { count: brand.productsCount || 0 })}</span>
            </div>
          </Link>
        ))}
      </div>

      {recentlyViewed.length ? (
        <>
          <div className="section-head">
            <h2>{t("home.recentlyViewed")}</h2>
            <Link to="/profile">{t("home.openInProfile")}</Link>
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
          <h3>{t("home.benefit.fastSearchTitle")}</h3>
          <p>{t("home.benefit.fastSearchText")}</p>
        </article>
        <article className="benefit-card">
          <h3>{t("home.benefit.livePricesTitle")}</h3>
          <p>{t("home.benefit.livePricesText")}</p>
        </article>
        <article className="benefit-card">
          <h3>{t("home.benefit.accountTitle")}</h3>
          <p>{t("home.benefit.accountText")}</p>
        </article>
      </div>
    </section>
  );
};

export default HomePage;

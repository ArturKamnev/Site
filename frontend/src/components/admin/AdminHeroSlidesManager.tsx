import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

import { useI18n } from "../../i18n/I18nProvider";
import { api } from "../../lib/api";
import type { HeroSlide } from "../../types";
import { getApiErrorMessage } from "./adminHelpers";

type SlideForm = {
  label: string;
  imageUrl: string;
  title: string;
  subtitle: string;
  buttonText: string;
  buttonLink: string;
  isActive: boolean;
};

const defaultSlideForm: SlideForm = {
  label: "",
  imageUrl: "",
  title: "",
  subtitle: "",
  buttonText: "",
  buttonLink: "",
  isActive: true,
};

type Props = {
  onChanged: () => void;
};

const AdminHeroSlidesManager = ({ onChanged }: Props) => {
  const { t } = useI18n();
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [form, setForm] = useState<SlideForm>(defaultSlideForm);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadSlides = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await api.get<HeroSlide[]>("/admin/hero-slides");
      setSlides(response.data);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, t("errors.generic")));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadSlides();
  }, [loadSlides]);

  const submitHeroSlide = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      await api.post("/admin/hero-slides", form);
      setForm(defaultSlideForm);
      onChanged();
      await loadSlides();
    } catch (saveError) {
      setError(getApiErrorMessage(saveError, t("errors.generic")));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleHeroSlide = async (slide: HeroSlide) => {
    await api.put(`/admin/hero-slides/${slide.id}`, {
      isActive: slide.is_active !== 1,
    });
    onChanged();
    await loadSlides();
  };

  const deleteHeroSlide = async (id: number) => {
    if (!window.confirm(`${t("admin.confirmDelete")}\n\n${t("admin.deleteWarning")}`)) {
      return;
    }

    try {
      await api.delete(`/admin/hero-slides/${id}`);
      onChanged();
      await loadSlides();
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError, t("admin.deleteFailed")));
    }
  };

  return (
    <section className="admin-section">
      <h2>{t("admin.heroSlides")}</h2>
      <div className="two-col">
        <form className="form surface" onSubmit={submitHeroSlide}>
          <h3>{t("admin.addSlide")}</h3>
          <input value={form.label} onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))} placeholder={t("admin.label")} required />
          <input value={form.imageUrl} onChange={(event) => setForm((prev) => ({ ...prev, imageUrl: event.target.value }))} placeholder={t("admin.imageUrl")} required />
          <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder={t("admin.slideTitle")} />
          <textarea value={form.subtitle} onChange={(event) => setForm((prev) => ({ ...prev, subtitle: event.target.value }))} placeholder={t("admin.slideSubtitle")} />
          <input value={form.buttonText} onChange={(event) => setForm((prev) => ({ ...prev, buttonText: event.target.value }))} placeholder={t("admin.buttonText")} />
          <input value={form.buttonLink} onChange={(event) => setForm((prev) => ({ ...prev, buttonLink: event.target.value }))} placeholder={t("admin.buttonLink")} />
          <label className="inline-checkbox">
            <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))} />
            {t("common.active")}
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" disabled={isSaving}>
            {isSaving ? t("admin.saving") : t("admin.createSlide")}
          </button>
        </form>

        <div className="form surface">
          <h3>{t("admin.currentSlides")}</h3>
          {isLoading ? <p className="muted">{t("admin.loadingData")}</p> : null}
          {slides.map((slide) => (
            <article key={slide.id} className="hero-slide-admin-item">
              <img src={slide.image_url} alt={slide.label} />
              <div>
                <strong>
                  #{slide.position} {slide.label}
                </strong>
                <p className="muted">{slide.title || t("admin.noTitle")}</p>
                <small>{slide.is_active ? t("common.active") : t("common.hidden")}</small>
              </div>
              <div className="inline-row">
                <button type="button" className="ghost-btn" onClick={() => toggleHeroSlide(slide)}>
                  {slide.is_active ? t("admin.hide") : t("admin.show")}
                </button>
                <button type="button" className="danger" onClick={() => deleteHeroSlide(slide.id)}>
                  {t("common.delete")}
                </button>
              </div>
            </article>
          ))}
          {!isLoading && !slides.length ? <p className="empty-state">{t("admin.noSlides")}</p> : null}
        </div>
      </div>
    </section>
  );
};

export default AdminHeroSlidesManager;

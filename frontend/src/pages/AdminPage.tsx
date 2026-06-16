import { useCallback, useEffect, useState } from "react";

import AdminBrandsManager from "../components/admin/AdminBrandsManager";
import AdminCategoriesManager from "../components/admin/AdminCategoriesManager";
import AdminCsvImport from "../components/admin/AdminCsvImport";
import AdminHeroSlidesManager from "../components/admin/AdminHeroSlidesManager";
import AdminOrdersManager from "../components/admin/AdminOrdersManager";
import AdminProductsManager from "../components/admin/AdminProductsManager";
import AdminStats, { type Dashboard } from "../components/admin/AdminStats";
import { useI18n } from "../i18n/I18nProvider";
import { api } from "../lib/api";

type AdminSection = "overview" | "import" | "products" | "brands" | "categories" | "slides" | "orders";

const adminSections: Array<{ id: AdminSection; labelKey: string }> = [
  { id: "overview", labelKey: "admin.nav.overview" },
  { id: "import", labelKey: "admin.nav.import" },
  { id: "products", labelKey: "admin.nav.products" },
  { id: "brands", labelKey: "admin.nav.brands" },
  { id: "categories", labelKey: "admin.nav.categories" },
  { id: "slides", labelKey: "admin.nav.slides" },
  { id: "orders", labelKey: "admin.nav.orders" },
];

const AdminPage = () => {
  const { t } = useI18n();
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);

  const loadDashboard = useCallback(async () => {
    const response = await api.get<Dashboard>("/admin/dashboard");
    setDashboard(response.data);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const renderSection = () => {
    switch (activeSection) {
      case "overview":
        return <AdminStats dashboard={dashboard} />;
      case "import":
        return <AdminCsvImport onImported={loadDashboard} />;
      case "products":
        return <AdminProductsManager onChanged={loadDashboard} />;
      case "brands":
        return <AdminBrandsManager onChanged={loadDashboard} />;
      case "categories":
        return <AdminCategoriesManager onChanged={loadDashboard} />;
      case "slides":
        return <AdminHeroSlidesManager onChanged={loadDashboard} />;
      case "orders":
        return <AdminOrdersManager onChanged={loadDashboard} />;
      default:
        return null;
    }
  };

  return (
    <section className="admin-page">
      <div className="title-block">
        <h1>{t("admin.title")}</h1>
        <p>{t("admin.description")}</p>
      </div>

      <nav className="admin-tabs" aria-label={t("admin.navigation")}>
        {adminSections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={activeSection === section.id ? "admin-tab active" : "admin-tab ghost-btn"}
            onClick={() => setActiveSection(section.id)}
            aria-current={activeSection === section.id ? "page" : undefined}
          >
            {t(section.labelKey)}
          </button>
        ))}
      </nav>

      {renderSection()}
    </section>
  );
};

export default AdminPage;

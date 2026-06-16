import { useI18n } from "../../i18n/I18nProvider";

export type Dashboard = {
  users: number;
  products: number;
  brands: number;
  categories: number;
  orders: number;
  heroSlides?: number;
};

type Props = {
  dashboard: Dashboard | null;
};

const AdminStats = ({ dashboard }: Props) => {
  const { t } = useI18n();
  const stats = [
    ["admin.users", dashboard?.users ?? 0],
    ["admin.products", dashboard?.products ?? 0],
    ["admin.brands", dashboard?.brands ?? 0],
    ["admin.categories", dashboard?.categories ?? 0],
    ["admin.slides", dashboard?.heroSlides ?? 0],
    ["admin.orders", dashboard?.orders ?? 0],
  ] as const;

  return (
    <div className="stats-grid">
      {stats.map(([label, value]) => (
        <article key={label} className="surface stat-card">
          <span>{t(label)}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </div>
  );
};

export default AdminStats;

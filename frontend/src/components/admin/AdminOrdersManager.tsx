import { useCallback, useEffect, useState } from "react";

import { useI18n } from "../../i18n/I18nProvider";
import { api } from "../../lib/api";
import type { AdminOrdersResponse, Order } from "../../types";
import { defaultPagination, getApiErrorMessage } from "./adminHelpers";

type OrderStatus = "PENDING" | "PROCESSING" | "SHIPPED" | "COMPLETED" | "CANCELED";
type OrderStatusFilter = "all" | OrderStatus;
type OrderSort = "newest" | "oldest" | "total_asc" | "total_desc";

const orderStatuses: OrderStatus[] = ["PENDING", "PROCESSING", "SHIPPED", "COMPLETED", "CANCELED"];

const getStatusClassName = (status: string) => `status-chip status-${status.toLowerCase()}`;

type Props = {
  onChanged: () => void;
};

const AdminOrdersManager = ({ onChanged }: Props) => {
  const { t, formatMoney, formatDateTime } = useI18n();
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState(defaultPagination);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<OrderStatusFilter>("all");
  const [sort, setSort] = useState<OrderSort>("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const getStatusLabel = (value: string) => {
    const key = `status.${value.toLowerCase()}`;
    const label = t(key);
    return label === key ? value : label;
  };

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await api.get<AdminOrdersResponse>("/admin/orders", {
        params: { page, pageSize, search: debouncedSearch || undefined, status, sort },
      });
      setOrders(response.data.items);
      setPagination(response.data.pagination);
    } catch (loadError) {
      setOrders([]);
      setPagination(defaultPagination);
      setError(getApiErrorMessage(loadError, t("errors.generic")));
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, page, pageSize, sort, status, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const updateStatus = async (orderId: number, nextStatus: string) => {
    setUpdatingId(orderId);
    setError("");
    try {
      await api.patch(`/admin/orders/${orderId}/status`, { status: nextStatus });
      onChanged();
      await loadOrders();
    } catch (updateError) {
      setError(getApiErrorMessage(updateError, t("errors.generic")));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <section className="admin-section">
      <div className="surface form">
        <div className="admin-section-head">
          <div>
            <h2>{t("admin.ordersTitle")}</h2>
            <p className="muted">{t("admin.ordersDescription")}</p>
          </div>
          <span className="muted">{t("admin.ordersFound", { count: pagination.total })}</span>
        </div>
        <div className="admin-directory-toolbar admin-orders-toolbar">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder={t("admin.searchOrders")}
          />
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as OrderStatusFilter);
              setPage(1);
            }}
            aria-label={t("common.status")}
          >
            <option value="all">{t("admin.allStatuses")}</option>
            {orderStatuses.map((orderStatus) => (
              <option key={orderStatus} value={orderStatus}>
                {getStatusLabel(orderStatus)}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as OrderSort);
              setPage(1);
            }}
            aria-label={t("common.sort")}
          >
            <option value="newest">{t("admin.sortNewest")}</option>
            <option value="oldest">{t("admin.sortOldest")}</option>
            <option value="total_asc">{t("admin.sortTotalAsc")}</option>
            <option value="total_desc">{t("admin.sortTotalDesc")}</option>
          </select>
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            aria-label={t("admin.pageSizeLabel")}
          >
            <option value={10}>{t("admin.pageSize", { count: 10 })}</option>
            <option value={25}>{t("admin.pageSize", { count: 25 })}</option>
            <option value={50}>{t("admin.pageSize", { count: 50 })}</option>
          </select>
        </div>
        {isLoading ? <p className="muted">{t("admin.loadingData")}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </div>

      <div className="orders admin-orders-grid">
        {orders.map((order) => (
          <article key={order.id} className="surface order-card admin-order-card">
            <div className="order-head">
              <h3>{t("admin.orderById", { id: order.id })}</h3>
              <span className={getStatusClassName(order.status)}>{getStatusLabel(order.status)}</span>
            </div>
            <div className="admin-order-meta">
              <span>
                <strong>{t("admin.orderCustomer")}:</strong> {order.full_name || order.userName || t("admin.noData")}
              </span>
              <span>
                <strong>{t("admin.orderContacts")}:</strong> {order.phone || t("admin.noData")} · {order.email || order.userEmail || t("admin.noData")}
              </span>
              <span>
                <strong>{t("common.total")}:</strong> {formatMoney(order.total)}
              </span>
              <span>
                <strong>{t("admin.orderCreatedAt")}:</strong> {formatDateTime(order.created_at)}
              </span>
            </div>
            <label className="admin-status-select">
              <span>{t("admin.orderStatus")}</span>
              <select value={order.status} disabled={updatingId === order.id} onChange={(event) => updateStatus(order.id, event.target.value)}>
                {orderStatuses.map((orderStatus) => (
                  <option key={orderStatus} value={orderStatus}>
                    {getStatusLabel(orderStatus)}
                  </option>
                ))}
              </select>
            </label>
            {order.items.length ? (
              <ul>
                {order.items.map((item) => (
                  <li key={item.id}>
                    {t("admin.orderItemQuantity", { name: item.snapshot_name, quantity: item.quantity })}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
        {!isLoading && !orders.length ? <p className="empty-state">{t("admin.noOrdersFound")}</p> : null}
      </div>

      <div className="pagination">
        <button type="button" disabled={isLoading || pagination.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
          {t("common.back")}
        </button>
        <span>{t("admin.pageOf", { page: pagination.page, totalPages: pagination.totalPages })}</span>
        <button type="button" disabled={isLoading || pagination.page >= pagination.totalPages} onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}>
          {t("common.next")}
        </button>
      </div>
    </section>
  );
};

export default AdminOrdersManager;

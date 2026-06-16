import { useState } from "react";
import type { FormEvent } from "react";

import { useI18n } from "../../i18n/I18nProvider";
import { api } from "../../lib/api";
import { getApiErrorMessage } from "./adminHelpers";

type CsvImportResult = {
  mode: "upsert" | "full_sync";
  totalRows: number;
  createdProducts: number;
  updatedProducts: number;
  createdBrands: number;
  createdCategories: number;
  deactivatedProducts: number;
  errors: Array<{
    row: number;
    message: string;
  }>;
};

type Props = {
  onImported: () => void;
};

const AdminCsvImport = ({ onImported }: Props) => {
  const { t } = useI18n();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvMode, setCsvMode] = useState<CsvImportResult["mode"]>("upsert");
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [error, setError] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const importCsv = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!csvFile) {
      setError(t("admin.csvSelectFileError"));
      return;
    }

    const formData = new FormData();
    formData.append("file", csvFile);
    formData.append("mode", csvMode);

    setIsImporting(true);
    try {
      const response = await api.post<CsvImportResult>("/admin/import/csv", formData);
      setResult(response.data);
      onImported();
    } catch (importError) {
      setError(getApiErrorMessage(importError, t("admin.csvImportFailed")));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <section className="admin-section">
      <h2>{t("admin.csvImportTitle")}</h2>
      <form className="form surface" onSubmit={importCsv}>
        <input
          type="file"
          accept=".csv,text/csv"
          aria-label={t("admin.csvImportTitle")}
          onChange={(event) => {
            setCsvFile(event.target.files?.[0] ?? null);
            setError("");
          }}
        />
        <select value={csvMode} onChange={(event) => setCsvMode(event.target.value as CsvImportResult["mode"])}>
          <option value="upsert">{t("admin.csvModeUpsert")}</option>
          <option value="full_sync">{t("admin.csvModeFullSync")}</option>
        </select>
        <button type="submit" disabled={isImporting}>
          {isImporting ? t("admin.csvImporting") : t("admin.csvImportButton")}
        </button>
        {error ? <p className="error">{error}</p> : null}
        {result ? (
          <div className="csv-import-summary">
            <div className="stats-grid">
              <article className="stat-card">
                <span>{t("admin.csvTotalRows")}</span>
                <strong>{result.totalRows}</strong>
              </article>
              <article className="stat-card">
                <span>{t("admin.csvCreatedProducts")}</span>
                <strong>{result.createdProducts}</strong>
              </article>
              <article className="stat-card">
                <span>{t("admin.csvUpdatedProducts")}</span>
                <strong>{result.updatedProducts}</strong>
              </article>
              <article className="stat-card">
                <span>{t("admin.csvCreatedBrands")}</span>
                <strong>{result.createdBrands}</strong>
              </article>
              <article className="stat-card">
                <span>{t("admin.csvCreatedCategories")}</span>
                <strong>{result.createdCategories}</strong>
              </article>
              <article className="stat-card">
                <span>{t("admin.csvDeactivatedProducts")}</span>
                <strong>{result.deactivatedProducts}</strong>
              </article>
            </div>
            {result.errors.length ? (
              <div>
                <strong>{t("admin.csvErrors")}</strong>
                <ul className="csv-import-errors">
                  {result.errors.map((item) => (
                    <li key={`${item.row}-${item.message}`}>
                      {t("admin.csvRowError", { row: item.row, message: item.message })}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="muted">{t("admin.csvNoErrors")}</p>
            )}
          </div>
        ) : null}
      </form>
    </section>
  );
};

export default AdminCsvImport;

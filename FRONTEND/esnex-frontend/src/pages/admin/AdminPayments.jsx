import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import API from "../../api/axios";
import {
  useWindowSize,
  inputStyle,
  buttonStyle,
  tableHeader,
  tableCell,
  sectionCardStyle,
  sectionHeadingStyle,
} from "./adminUtils";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";

const STATUS_LABELS = {
  paid: "Success",
  pending: "Pending",
  failed: "Failed",
  refunded: "Refunded",
};

const STATUS_COLORS = {
  paid: "#22c55e",
  pending: "#f59e0b",
  failed: "#ef4444",
  refunded: "#3b82f6",
};

const PAYMENT_METHODS = ["Wave", "Card", "Bank Transfer", "Manual", "Wallet", "Other"];

const formatCurrency = (value) => {
  return typeof value === "number" ? `D${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "D0";
};

const badgeStyle = (status) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.35rem 0.8rem",
  borderRadius: "999px",
  backgroundColor: `${STATUS_COLORS[status] || "#94a3b8"}33`,
  color: STATUS_COLORS[status] || "#94a3b8",
  fontWeight: 700,
  fontSize: "0.85rem",
});

export default function AdminPayments() {
  const { width: windowWidth } = useWindowSize();
  const { searchTerm = "" } = useOutletContext() || {};
  const isMobile = windowWidth < 900;
  const [summary, setSummary] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [reconciliation, setReconciliation] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState(null);
  const [chartPeriod, setChartPeriod] = useState("month");
  const [filters, setFilters] = useState({
    search: searchTerm || "",
    status: "",
    method: "",
    course: "",
    from: "",
    to: "",
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [courses, setCourses] = useState([]);

  const loadSummary = async () => {
    try {
      const res = await API.get("/payments/admin/summary");
      setSummary(res.data.data);
      const availableCourses = Array.from(new Set((res.data.data.mostPurchasedCourses || []).map((item) => item.name)));
      setCourses(availableCourses);
    } catch (err) {
      console.error("Failed to load payment summary", err);
    }
  };

  const loadPayments = async () => {
    setLoading(true);
    try {
      const res = await API.get("/payments/admin/list", {
        params: {
          search: filters.search,
          status: filters.status,
          method: filters.method,
          course: filters.course,
          from: filters.from,
          to: filters.to,
          page,
          limit: 25,
        },
      });
      setPayments(res.data.data.payments || []);
      setTotal(res.data.data.total || 0);
    } catch (err) {
      console.error("Failed to load admin payments", err);
      setPayments([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const loadChartData = async () => {
    try {
      const res = await API.get("/payments/admin/revenue-chart", {
        params: { period: chartPeriod },
      });
      setChartData(res.data.data || []);
    } catch (err) {
      console.error("Failed to load revenue chart data", err);
      setChartData([]);
    }
  };

  const loadReconciliation = async () => {
    try {
      const res = await API.get("/payments/admin/reconciliation");
      setReconciliation(res.data.data || {});
    } catch (err) {
      console.error("Failed to load reconciliation data", err);
      setReconciliation(null);
    }
  };

  useEffect(() => {
    loadSummary();
    loadReconciliation();
  }, []);

  useEffect(() => {
    loadChartData();
  }, [chartPeriod]);

  useEffect(() => {
    if (searchTerm) {
      setFilters((prev) => ({ ...prev, search: searchTerm }));
      setPage(1);
    }
  }, [searchTerm]);

  useEffect(() => {
    loadPayments();
  }, [filters, page]);

  const handleFilterChange = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const openDetails = async (paymentId) => {
    try {
      const res = await API.get(`/payments/admin/${paymentId}/details`);
      setDetails(res.data.data);
    } catch (err) {
      console.error("Failed to load payment detail", err);
      setDetails(null);
    }
  };

  const closeDetails = () => setDetails(null);

  const exportUrl = (format) => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    if (filters.method) params.set("method", filters.method);
    if (filters.course) params.set("course", filters.course);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    params.set("format", format);
    return `/api/payments/admin/export?${params.toString()}`;
  };

  const handleExportPdf = () => {
    const html = `
      <html>
        <head>
          <title>Payment Export</title>
          <style>body{font-family:Arial,sans-serif;padding:24px;color:#111;}table{width:100%;border-collapse:collapse;margin-top:16px;}th,td{border:1px solid #ddd;padding:8px;text-align:left;}th{background:#f3f4f6;}</style>
        </head>
        <body>
          <h1>Payment Export</h1>
          <p>Generated ${new Date().toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Course</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${payments.map((row) => `
                <tr>
                  <td>${row.studentName}</td>
                  <td>${row.courseTitle}</td>
                  <td>${formatCurrency(row.amountPaid)}</td>
                  <td>${STATUS_LABELS[row.paymentStatus] || row.paymentStatus}</td>
                  <td>${new Date(row.paymentDate || row.createdAt).toLocaleString()}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    }
  };

  const summaryCards = summary
    ? [
        { label: "Total Payments", value: summary.totalPayments },
        { label: "Total Revenue", value: formatCurrency(summary.totalRevenue) },
        { label: "Pending Payments", value: summary.pendingPayments },
        { label: "Successful Payments", value: summary.successfulPayments },
        { label: "Failed Payments", value: summary.failedPayments },
        { label: "Refunded Payments", value: summary.refundedPayments },
        { label: "Today’s Revenue", value: formatCurrency(summary.todaysPayments) },
        { label: "Total Students Enrolled", value: summary.totalStudentsEnrolled },
      ]
    : [];

  const chartColors = ["#60a5fa", "#34d399", "#f59e0b", "#f87171", "#3b82f6"];

  return (
    <div style={{ padding: isMobile ? "1rem" : "2rem", color: "#e2e8f0" }}>
      <div style={{ display: "grid", gap: "1rem", marginBottom: "1rem" }}>
        <div style={{ ...sectionCardStyle, padding: isMobile ? "1rem" : "1.5rem" }}>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", gap: "1rem" }}>
            <div>
              <p style={{ margin: 0, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.2em", fontSize: "0.8rem" }}>Payment Monitoring</p>
              <h1 style={{ margin: "0.5rem 0 0", fontSize: isMobile ? "1.5rem" : "2.5rem" }}>Payments & Enrollment Tracking</h1>
              <p style={{ margin: "0.75rem 0 0", color: "#94a3b8", maxWidth: "64rem" }}>
                Monitor student payments, enrollment activity, refunds, and revenue trends in one place.
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              <button type="button" style={buttonStyle} onClick={() => window.open(exportUrl("csv"), "_blank")}>Export CSV</button>
              <button type="button" style={buttonStyle} onClick={() => window.open(exportUrl("excel"), "_blank")}>Export Excel</button>
              <button type="button" style={buttonStyle} onClick={handleExportPdf}>Export PDF</button>
            </div>
          </div>
        </div>

        {summary?.notifications && (
          <div style={{ ...sectionCardStyle, backgroundColor: "rgba(56, 189, 248, 0.08)", borderColor: "rgba(56, 189, 248, 0.2)" }}>
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Live payment alerts</h2>
            <p style={{ margin: "0.75rem 0 0", color: "#cbd5e1" }}>
              {summary.notifications.newPaymentCount} new payment(s) pending, {summary.notifications.failedPaymentCount} failed and {summary.notifications.refundedCount} refund(s) recorded.
            </p>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: isMobile ? "1fr" : "repeat(4, minmax(0, 1fr))", marginBottom: "1rem" }}>
        {summaryCards.map((card) => (
          <div key={card.label} style={{ ...sectionCardStyle, padding: "1rem", minHeight: "120px", backgroundColor: "rgba(15, 23, 42, 0.9)" }}>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.15em" }}>{card.label}</p>
            <p style={{ margin: "0.85rem 0 0", fontSize: "1.75rem", fontWeight: 700, color: "#f8fafc" }}>{card.value}</p>
          </div>
        ))}
      </div>

      {reconciliation && (
        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: isMobile ? "1fr" : "repeat(4, minmax(0, 1fr))", marginBottom: "1rem" }}>
          <div style={{ ...sectionCardStyle, padding: "1rem", backgroundColor: "rgba(34, 197, 94, 0.1)", borderColor: "rgba(34, 197, 94, 0.2)" }}>
            <p style={{ margin: 0, color: "#86efac", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.15em" }}>Verified Payments</p>
            <p style={{ margin: "0.85rem 0 0", fontSize: "1.75rem", fontWeight: 700, color: "#22c55e" }}>{reconciliation.verified || 0}</p>
          </div>
          <div style={{ ...sectionCardStyle, padding: "1rem", backgroundColor: "rgba(59, 130, 246, 0.1)", borderColor: "rgba(59, 130, 246, 0.2)" }}>
            <p style={{ margin: 0, color: "#93c5fd", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.15em" }}>Manual Grants</p>
            <p style={{ margin: "0.85rem 0 0", fontSize: "1.75rem", fontWeight: 700, color: "#3b82f6" }}>{reconciliation.manual || 0}</p>
          </div>
          <div style={{ ...sectionCardStyle, padding: "1rem", backgroundColor: "rgba(251, 146, 60, 0.1)", borderColor: "rgba(251, 146, 60, 0.2)" }}>
            <p style={{ margin: 0, color: "#fed7aa", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.15em" }}>Unverified</p>
            <p style={{ margin: "0.85rem 0 0", fontSize: "1.75rem", fontWeight: 700, color: "#fb923c" }}>{reconciliation.unverified || 0}</p>
          </div>
          <div style={{ ...sectionCardStyle, padding: "1rem", backgroundColor: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.2)" }}>
            <p style={{ margin: 0, color: "#fca5a5", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.15em" }}>Orphaned</p>
            <p style={{ margin: "0.85rem 0 0", fontSize: "1.75rem", fontWeight: 700, color: "#ef4444" }}>{reconciliation.orphaned || 0}</p>
          </div>
        </div>
      )}

      {reconciliation && (reconciliation.orphaned > 0 || reconciliation.unverified > 0) && (
        <div style={{ ...sectionCardStyle, backgroundColor: "rgba(239, 68, 68, 0.08)", borderColor: "rgba(239, 68, 68, 0.2)", marginBottom: "1rem" }}>
          <p style={{ margin: 0, color: "#fca5a5", fontWeight: 700 }}>⚠️ Reconciliation Alert</p>
          <p style={{ margin: "0.5rem 0 0", color: "#f87171" }}>
            {reconciliation.unverified > 0 && `${reconciliation.unverified} unverified enrollments. `}
            {reconciliation.orphaned > 0 && `${reconciliation.orphaned} orphaned payments detected.`}
            Please review and reconcile legacy data.
          </p>
        </div>
      )}

      <div style={{ display: "grid", gap: "1rem", marginBottom: "1rem" }}>
        <div style={{ ...sectionCardStyle, padding: "1rem 1rem 0", position: "sticky", top: "1rem", zIndex: 10, background: "rgba(2, 6, 23, 0.94)" }}>
          <div style={{ display: "grid", gap: isMobile ? "0.75rem" : "1rem", gridTemplateColumns: isMobile ? "1fr" : "repeat(4, minmax(0, 1fr))" }}>
            <label htmlFor="admin-payments-search" className="sr-only">Search payments</label>
            <input
              id="admin-payments-search"
              aria-label="Search payments by student, email, or course"
              placeholder="Search student, email, course..."
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              style={inputStyle}
            />
            <select aria-label="Filter by payment status" style={inputStyle} value={filters.status} onChange={(e) => handleFilterChange("status", e.target.value)}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="paid">Success</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
            <select aria-label="Filter by payment method" style={inputStyle} value={filters.method} onChange={(e) => handleFilterChange("method", e.target.value)}>
              <option value="">All methods</option>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
            <select aria-label="Filter by course" style={inputStyle} value={filters.course} onChange={(e) => handleFilterChange("course", e.target.value)}>
              <option value="">All courses</option>
              {courses.map((courseTitle) => (
                <option key={courseTitle} value={courseTitle}>{courseTitle}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gap: isMobile ? "0.75rem" : "1rem", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", marginTop: "1rem" }}>
            <label htmlFor="payments-from" className="sr-only">From date</label>
            <input id="payments-from" aria-label="From date" type="date" style={inputStyle} value={filters.from} onChange={(e) => handleFilterChange("from", e.target.value)} />
            <label htmlFor="payments-to" className="sr-only">To date</label>
            <input id="payments-to" aria-label="To date" type="date" style={inputStyle} value={filters.to} onChange={(e) => handleFilterChange("to", e.target.value)} />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: "1rem", marginBottom: "1rem", gridTemplateColumns: isMobile ? "1fr" : "repeat(1, minmax(0, 1fr))" }}>
        <div style={{ ...sectionCardStyle, padding: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "1rem" }}>
            <h2 style={sectionHeadingStyle}>Revenue Chart</h2>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {["day", "week", "month"].map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setChartPeriod(period)}
                  style={{
                    ...buttonStyle,
                    backgroundColor: chartPeriod === period ? "#2563eb" : "#1d4ed8",
                    fontWeight: chartPeriod === period ? 700 : 500,
                  }}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: "0.8rem" }} />
                <YAxis stroke="#94a3b8" />
                <Tooltip cursor={{ stroke: "#0ea5e9", strokeDasharray: "3 3" }} />
                <Line type="monotone" dataKey="revenue" stroke="#38bdf8" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", marginBottom: "1rem" }}>
        <div style={{ ...sectionCardStyle, padding: "1rem" }}>
          <h2 style={sectionHeadingStyle}>Top purchased courses</h2>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={summary?.mostPurchasedCourses || []} dataKey="count" nameKey="name" outerRadius={100} fill="#3b82f6" label={{ fill: "#f8fafc" }}>
                  {(summary?.mostPurchasedCourses || []).map((entry, index) => (
                    <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div style={{ ...sectionCardStyle, padding: "1rem" }}>
          <h2 style={sectionHeadingStyle}>Payment status trends</h2>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary?.statusTrend || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="status" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {(summary?.statusTrend || []).map((entry, index) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || chartColors[index % chartColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ ...sectionCardStyle, overflowX: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <h2 style={sectionHeadingStyle}>Payment history</h2>
            <p style={{ margin: 0, color: "#94a3b8" }}>{total} records found</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <span style={{ color: "#94a3b8" }}>Page {page} / {Math.max(1, Math.ceil(total / 25))}</span>
            <button type="button" style={{ ...buttonStyle, backgroundColor: "#1d4ed8" }} onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>Prev</button>
            <button type="button" style={{ ...buttonStyle, backgroundColor: "#1d4ed8" }} onClick={() => setPage(page + 1)} disabled={page >= Math.max(1, Math.ceil(total / 25))}>Next</button>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
          <thead>
            <tr style={{ color: "#94a3b8", borderBottom: "1px solid rgba(148, 163, 184, 0.12)", textAlign: "left" }}>
              <th style={{ ...tableHeader, padding: "1rem" }}>Student</th>
              <th style={{ ...tableHeader, padding: "1rem" }}>Course / Subject</th>
              <th style={{ ...tableHeader, padding: "1rem" }}>Amount</th>
              <th style={{ ...tableHeader, padding: "1rem" }}>Method</th>
              <th style={{ ...tableHeader, padding: "1rem" }}>Transaction</th>
              <th style={{ ...tableHeader, padding: "1rem" }}>Status</th>
              <th style={{ ...tableHeader, padding: "1rem" }}>Date</th>
              <th style={{ ...tableHeader, padding: "1rem" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ ...tableCell, padding: "1.5rem" }}>Loading payment records...</td></tr>
            ) : payments.length === 0 ? (
              <tr><td colSpan={8} style={{ ...tableCell, padding: "1.5rem" }}>No payment records match the filters.</td></tr>
            ) : payments.map((payment) => (
              <tr key={payment.paymentId || payment.transactionId || payment.courseTitle || Math.random()} style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.08)" }}>
                <td style={{ ...tableCell }}>{payment.studentName}<br /><span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>{payment.studentEmail}</span></td>
                <td style={{ ...tableCell }}>{payment.courseTitle}<br /><span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>{payment.courseSubject}</span></td>
                <td style={{ ...tableCell }}>{formatCurrency(payment.amountPaid)}</td>
                <td style={{ ...tableCell }}>{payment.paymentMethod}</td>
                <td style={{ ...tableCell }}>{payment.transactionId || payment.paymentReference || "—"}</td>
                <td style={{ ...tableCell }}><span style={badgeStyle(payment.paymentStatus)}>{STATUS_LABELS[payment.paymentStatus] || payment.paymentStatus}</span></td>
                <td style={{ ...tableCell }}>{new Date(payment.paymentDate || payment.createdAt).toLocaleString()}</td>
                <td style={{ ...tableCell }}>
                  <button
                    type="button"
                    onClick={() => openDetails(payment.paymentId)}
                    style={{ ...buttonStyle, backgroundColor: "#2563eb" }}
                  >View Details</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {details && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0, 0, 0, 0.55)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ width: isMobile ? "100%" : "min(900px, 95%)", maxHeight: "90vh", overflowY: "auto", backgroundColor: "#020617", borderRadius: "1.5rem", border: "1px solid rgba(148, 163, 184, 0.18)", padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.4rem" }}>Payment details</h2>
                <p style={{ margin: "0.5rem 0 0", color: "#94a3b8" }}>{details.studentName} · {details.studentEmail}</p>
              </div>
              <button type="button" onClick={closeDetails} style={{ ...buttonStyle, backgroundColor: "#ef4444" }}>Close</button>
            </div>

            <div style={{ display: "grid", gap: "1rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr" }}>
                <div style={sectionCardStyle}>
                  <p style={{ margin: 0, color: "#94a3b8" }}>Course enrolled</p>
                  <p style={{ margin: "0.5rem 0 0", fontWeight: 700, color: "#f8fafc" }}>{details.courseTitle}</p>
                  <p style={{ margin: "0.35rem 0 0", color: "#94a3b8" }}>{details.courseSubject}</p>
                </div>
                <div style={sectionCardStyle}>
                  <p style={{ margin: 0, color: "#94a3b8" }}>Receipt</p>
                  <p style={{ margin: "0.5rem 0 0", fontWeight: 700, color: "#f8fafc" }}>{details.paymentReference || details.transactionId}</p>
                  <p style={{ margin: "0.35rem 0 0", color: "#94a3b8" }}>{details.paymentMethod}</p>
                </div>
              </div>

              <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))" }}>
                <div style={sectionCardStyle}>
                  <p style={{ margin: 0, color: "#94a3b8" }}>Payment amount</p>
                  <p style={{ margin: "0.5rem 0 0", fontWeight: 700, color: "#f8fafc" }}>{formatCurrency(details.amountPaid)}</p>
                </div>
                <div style={sectionCardStyle}>
                  <p style={{ margin: 0, color: "#94a3b8" }}>Payment status</p>
                  <p style={{ margin: "0.5rem 0 0", fontWeight: 700, color: "#f8fafc" }}>{STATUS_LABELS[details.paymentStatus] || details.paymentStatus}</p>
                </div>
                <div style={sectionCardStyle}>
                  <p style={{ margin: 0, color: "#94a3b8" }}>Access expiry</p>
                  <p style={{ margin: "0.5rem 0 0", fontWeight: 700, color: "#f8fafc" }}>{details.validUntil ? new Date(details.validUntil).toLocaleString() : "Not set"}</p>
                </div>
              </div>

              <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
                <div style={sectionCardStyle}>
                  <p style={{ margin: 0, color: "#94a3b8" }}>Payment date</p>
                  <p style={{ margin: "0.5rem 0 0", fontWeight: 700, color: "#f8fafc" }}>{details.paymentDate ? new Date(details.paymentDate).toLocaleString() : "Not paid yet"}</p>
                </div>
                <div style={sectionCardStyle}>
                  <p style={{ margin: 0, color: "#94a3b8" }}>Device / IP</p>
                  <p style={{ margin: "0.5rem 0 0", fontWeight: 700, color: "#f8fafc" }}>{details.deviceInfo?.ipAddress || "—"}</p>
                  <p style={{ margin: "0.35rem 0 0", color: "#94a3b8" }}>{details.deviceInfo?.browser || details.deviceInfo?.platform || "—"}</p>
                </div>
              </div>
            </div>

            <div style={{ ...sectionCardStyle, padding: "1rem" }}>
              <h3 style={{ margin: "0 0 0.75rem", color: "#f8fafc" }}>Audit history</h3>
              {details.auditLogs?.length ? (
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.75rem" }}>
                  {details.auditLogs.map((log, index) => (
                    <li key={`${log.event}-${index}`} style={{ background: "rgba(255,255,255,0.03)", borderRadius: "1rem", padding: "0.85rem" }}>
                      <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.9rem" }}>{log.event.replace(/_/g, " ")}</p>
                      <p style={{ margin: "0.35rem 0 0", color: "#f8fafc" }}>{log.details}</p>
                      <p style={{ margin: "0.35rem 0 0", color: "#64748b", fontSize: "0.8rem" }}>{new Date(log.createdAt).toLocaleString()}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0, color: "#94a3b8" }}>No audit records available.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

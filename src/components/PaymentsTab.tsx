import React, { useState } from "react";
import { Payment, Purchase } from "../types";
import { formatCurrency, formatDateDisplay } from "../data";
import { CreditCard, Search, Calendar, Edit, RotateCcw, TrendingDown, ClipboardList, Wallet, DollarSign, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface PaymentsTabProps {
  payments: Payment[];
  purchases: Purchase[];
  onAddPayment: () => void;
  onEditPayment: (payment: Payment) => void;
}

export const PaymentsTab: React.FC<PaymentsTabProps> = ({ payments, purchases, onAddPayment, onEditPayment }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [selectedRange, setSelectedRange] = useState("all");

  // Sorting State
  const [sortField, setSortField] = useState<string>("date");
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const renderSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-gray-500 shrink-0" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3 h-3 text-blue-400 shrink-0" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-400 shrink-0" />
    );
  };

  const suppliersNames = React.useMemo(() => {
    return Array.from(new Set([
      ...purchases.map(p => p.Fournisseur),
      ...payments.map(p => p.Fournisseur)
    ].filter(Boolean)));
  }, [purchases, payments]);

  // Calculate high value financial KPIs
  const totalPurchasesSum = purchases.reduce((acc, p) => acc + (p.total || 0), 0);
  const totalPaymentsSum = payments.reduce((acc, p) => acc + (p.Payment || 0), 0);
  const remainingDebtSum = totalPurchasesSum - totalPaymentsSum;

  const isDateInRange = (dateStr: string, range: string): boolean => {
    if (!dateStr) return false;
    const now = new Date();
    const cleanDateStr = dateStr.split(" ")[0];
    const itemDate = new Date(cleanDateStr);

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    switch (range) {
      case "today":
        return itemDate >= todayStart;
      case "month":
        return itemDate >= startOfMonth;
      case "all":
      default:
        return true;
    }
  };

  const filteredPayments = payments.filter(pay => {
    // Search
    const matchesSearch = !searchQuery ? true : (
      (pay.ID || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (pay.Fournisseur || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Supplier filter
    const matchesSupplier = !selectedSupplier ? true : pay.Fournisseur === selectedSupplier;

    // Date
    const matchesDate = isDateInRange(pay.date, selectedRange);

    return matchesSearch && matchesSupplier && matchesDate;
  });

  const sortedPayments = React.useMemo(() => {
    const items = [...filteredPayments];
    if (!sortField) return items;

    items.sort((a, b) => {
      let valA = a[sortField as keyof Payment];
      let valB = b[sortField as keyof Payment];

      if (valA === undefined || valA === null) valA = "";
      if (valB === undefined || valB === null) valB = "";

      if (sortField === "date") {
        const dateA = new Date(String(valA).split(" ")[0]).getTime() || 0;
        const dateB = new Date(String(valB).split(" ")[0]).getTime() || 0;
        return sortDirection === "asc" ? dateA - dateB : dateB - dateA;
      }

      if (typeof valA === "number" && typeof valB === "number") {
        return sortDirection === "asc" ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortDirection === "asc" ? strA.localeCompare(strB, "ar") : strB.localeCompare(strA, "ar");
    });

    return items;
  }, [filteredPayments, sortField, sortDirection]);

  const handleReset = () => {
    setSearchQuery("");
    setSelectedSupplier("");
    setSelectedRange("all");
  };

  return (
    <div className="space-y-6 text-right animate-fade-in" dir="rtl">
      {/* 4 KPI Cards aligned uniquely at the top */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="payments-kpis-grid">
        {/* KPI 1: Total Purchasing liability */}
        <div className="bg-[#111930]/60 border border-white/5 p-5 rounded-2xl relative overflow-hidden glass-effect">
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-500"></div>
          <div className="flex justify-between items-start mb-2">
            <span className="text-gray-400 text-xs font-medium">إجمالي المشتريات المستحقة</span>
            <Wallet className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-base font-bold font-mono text-red-400">{formatCurrency(totalPurchasesSum)}</div>
          <div className="text-[9px] text-gray-500 mt-1">تراكم فواتير توريد البضاعة</div>
        </div>

        {/* KPI 2: Total payments disbursed */}
        <div className="bg-[#111930]/60 border border-white/5 p-5 rounded-2xl relative overflow-hidden glass-effect">
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500"></div>
          <div className="flex justify-between items-start mb-2">
            <span className="text-gray-400 text-xs font-medium">إجمالي المدفوعات للموردين</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-base font-bold font-mono text-emerald-400">{formatCurrency(totalPaymentsSum)}</div>
          <div className="text-[9px] text-emerald-500 mt-1">كل الحوالات والذمم المدفوعة</div>
        </div>

        {/* KPI 3: Remaining liability balance */}
        <div className="bg-[#111930]/60 border border-white/5 p-5 rounded-2xl relative overflow-hidden glass-effect">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500"></div>
          <div className="flex justify-between items-start mb-2">
            <span className="text-gray-400 text-xs font-medium">الرصيد المتبقي بذمتكم</span>
            <TrendingDown className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-base font-bold font-mono text-amber-400">{formatCurrency(remainingDebtSum)}</div>
          <div className="text-[9px] text-gray-500 mt-1">تحت السداد والتسوية الحالية</div>
        </div>

        {/* KPI 4: Disbursed invoices counts */}
        <div className="bg-[#111930]/60 border border-white/5 p-5 rounded-2xl relative overflow-hidden glass-effect">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500"></div>
          <div className="flex justify-between items-start mb-2">
            <span className="text-gray-400 text-xs font-medium">حوالات الدفع المسجلة</span>
            <ClipboardList className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-base font-bold font-mono text-blue-400">{payments.length} حوالة</div>
          <div className="text-[9px] text-gray-500 mt-1">إجمالي الحركات والوصولات</div>
        </div>
      </div>

      {/* Filter and control panel */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-[#111930]/65 border border-white/5 p-4 rounded-xl glass-effect">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto">
          {/* Quick text search */}
          <div className="relative">
            <input
              type="text"
              placeholder="ابحث برقم الورقة / اسم المورد..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#0d1426] border border-white/10 text-xs rounded-xl pr-9 pl-4 py-2 text-white focus:outline-none focus:border-blue-500/50 h-9"
            />
            <Search className="w-3.5 h-3.5 text-gray-500 absolute right-3 top-2.5" />
          </div>

          {/* Supplier dropdown */}
          <select
            value={selectedSupplier}
            onChange={e => setSelectedSupplier(e.target.value)}
            className="bg-[#0d1426] border border-white/10 text-xs rounded-xl px-3 py-2 text-white h-9"
          >
            <option value="">جميع الموردين</option>
            {suppliersNames.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Timeframe */}
          <select
            value={selectedRange}
            onChange={e => setSelectedRange(e.target.value)}
            className="bg-[#0d1426] border border-white/10 text-xs rounded-xl px-3 py-2 text-white h-9"
          >
            <option value="all">كل الحوالات</option>
            <option value="today">اليوم</option>
            <option value="month">هذا الشهر</option>
          </select>
        </div>

        <div className="flex gap-2 w-full md:w-auto shrink-0 justify-end">
          <button
            onClick={handleReset}
            title="إلغاء التصفية"
            className="p-2 bg-white/5 border border-white/5 hover:bg-white/10 rounded-xl text-gray-300 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          
          <button
            onClick={onAddPayment}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg shadow-blue-900/20"
          >
            <CreditCard className="w-4 h-4" />
            <span>تسجيل دفعة لمورد</span>
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-[#111930]/40 border border-white/5 rounded-2xl shadow-xl overflow-hidden glass-effect">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-[#0d1426] text-gray-400 text-[10px] font-bold uppercase tracking-wider border-b border-white/5 font-mono select-none">
              <tr>
                <th onClick={() => handleSort("ID")} className="px-6 py-4 cursor-pointer hover:bg-white/[0.05] transition-colors">
                  <div className="flex items-center gap-1 justify-start">
                    <span>الرقم</span>
                    {renderSortIcon("ID")}
                  </div>
                </th>
                <th onClick={() => handleSort("date")} className="px-6 py-4 cursor-pointer hover:bg-white/[0.05] transition-colors">
                  <div className="flex items-center gap-1 justify-start">
                    <span>التاريخ</span>
                    {renderSortIcon("date")}
                  </div>
                </th>
                <th onClick={() => handleSort("Payment")} className="px-6 py-4 cursor-pointer hover:bg-white/[0.05] transition-colors text-emerald-400">
                  <div className="flex items-center gap-1 justify-start">
                    <span>الدفعة</span>
                    {renderSortIcon("Payment")}
                  </div>
                </th>
                <th onClick={() => handleSort("Fournisseur")} className="px-6 py-4 cursor-pointer hover:bg-white/[0.05] transition-colors font-sans text-gray-300">
                  <div className="flex items-center gap-1 justify-start">
                    <span>المورد</span>
                    {renderSortIcon("Fournisseur")}
                  </div>
                </th>
                <th className="px-6 py-4 text-center">
                  <span>خيارات</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-gray-200 font-sans">
              {sortedPayments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-gray-500 font-medium">
                    لا توجد حوالات سداد متوافقة مع اختيارات التصفية الحالية
                  </td>
                </tr>
              ) : (
                sortedPayments.map((pay, idx) => (
                  <tr key={pay.ID || idx} className="hover:bg-white/[0.02] transition-colors">
                    {/* ID */}
                    <td className="px-6 py-4 font-mono font-bold text-blue-400 text-sm">
                      {pay.ID}
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4 font-mono text-gray-400">
                      {formatDateDisplay(pay.date)}
                    </td>

                    {/* Payment amount: Section 5.8: "Payment-green-bold" */}
                    <td className="px-6 py-4 font-mono text-sm font-bold text-emerald-400">
                      {formatCurrency(pay.Payment || 0)}
                    </td>

                    {/* Supplier */}
                    <td className="px-6 py-4 font-semibold text-white/90">
                      {pay.Fournisseur}
                    </td>

                    {/* Edit Option button */}
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => onEditPayment(pay)}
                        className="p-1 px-2.5 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white font-semibold rounded-lg text-[11px] transition-colors inline-flex items-center gap-1 border border-white/5"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>تعديل</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

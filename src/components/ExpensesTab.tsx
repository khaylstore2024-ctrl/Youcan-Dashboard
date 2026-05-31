import React, { useState } from "react";
import { Expense, Order } from "../types";
import { formatCurrency, formatDateDisplay } from "../data";
import { Receipt, Search, RotateCcw, Plus, Edit, Coins, DollarSign, Sprout, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface ExpensesTabProps {
  expenses: Expense[];
  sales: Order[];
  onAddExpense: () => void;
  onEditExpense: (expense: Expense) => void;
}

export const ExpensesTab: React.FC<ExpensesTabProps> = ({ expenses, sales, onAddExpense, onEditExpense }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("");
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

  // Sum up Delivered Sales Bénéfice
  const totalDeliveredBenefice = sales.reduce((acc, s) => {
    if (s.delivery === "Delivered") {
      return acc + (s["Bénéfice"] || 0);
    }
    return acc;
  }, 0);

  // Sum of Expenses.Prix (Must use 'Prix' as per Section 9 Rule 18: "Expenses column='Prix' Not amount, total, cost")
  const totalExpensesSum = expenses.reduce((acc, exp) => acc + (exp.Prix || 0), 0);

  // Net Profit = Σ(Bénéfice) - Σ(Expenses.Prix) (Section 4.2 constraint!)
  const netProfit = totalDeliveredBenefice - totalExpensesSum;

  const distinctTapers = Array.from(new Set(expenses.map(e => e.Taper).filter(Boolean)));

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

  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = !searchQuery ? true : (
      (exp.ID || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (exp.Taper || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    const matchesType = !selectedType ? true : exp.Taper === selectedType;
    const matchesDate = isDateInRange(exp.date, selectedRange);

    return matchesSearch && matchesType && matchesDate;
  });

  const sortedExpenses = React.useMemo(() => {
    const items = [...filteredExpenses];
    if (!sortField) return items;

    items.sort((a, b) => {
      let valA = a[sortField as keyof Expense];
      let valB = b[sortField as keyof Expense];

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
  }, [filteredExpenses, sortField, sortDirection]);

  const handleReset = () => {
    setSearchQuery("");
    setSelectedType("");
    setSelectedRange("all");
  };

  return (
    <div className="space-y-6 text-right animate-fade-in" dir="rtl">
      {/* 2 Big visual Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="expenses-kpis">
        {/* Card 1: Expenses total */}
        <div className="bg-[#111930]/65 border border-white/5 p-6 rounded-2xl relative overflow-hidden glass-effect flex gap-4 items-center">
          <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500"></div>
          <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <div className="text-gray-400 text-xs font-medium">إجمالي التكاليف والمصاريف المسجلة</div>
            <div className="text-2xl font-bold font-mono text-white mt-1">{formatCurrency(totalExpensesSum)}</div>
            <div className="text-[10px] text-gray-500 mt-1 font-sans">
              مسجلة عبر <span className="text-gray-300 font-bold">{expenses.length} مستندات مصاريف</span>
            </div>
          </div>
        </div>

        {/* Card 2: Combined Net profit: Section 4.2 net profit calculation! */}
        <div className="bg-[#111930]/65 border border-white/5 p-6 rounded-2xl relative overflow-hidden glass-effect flex gap-4 items-center">
          <div className={`absolute top-0 left-0 right-0 h-1 ${netProfit >= 0 ? "bg-emerald-500" : "bg-red-500"}`}></div>
          <div className={`p-3 rounded-xl ${netProfit >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
            <Sprout className="w-6 h-6" />
          </div>
          <div>
            <div className="text-gray-400 text-xs font-medium">صافي الأرباح العام للمشروع</div>
            <div className={`text-2xl font-bold font-mono mt-1 ${netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {formatCurrency(netProfit)}
            </div>
            <div className="text-[10px] text-gray-500 mt-1 font-sans">
              (إجمالي أرباح التوصيل <span className="text-gray-300 font-semibold">{formatCurrency(totalDeliveredBenefice)}</span>) مخصوماً منه المصاريف
            </div>
          </div>
        </div>
      </div>

      {/* Filter and edit controls */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-[#111930]/65 border border-white/5 p-4 rounded-xl glass-effect">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto">
          {/* Text search */}
          <div className="relative">
            <input
              type="text"
              placeholder="ابحث بوصف المصروف..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#0d1426] border border-white/10 text-xs rounded-xl pr-9 pl-4 py-2 text-white focus:outline-none focus:border-blue-500/50 h-9"
            />
            <Search className="w-3.5 h-3.5 text-gray-500 absolute right-3 top-2.5" />
          </div>

          {/* Type dropdown (Taper selection) */}
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className="bg-[#0d1426] border border-white/10 text-xs rounded-xl px-3 py-2 text-white h-9"
          >
            <option value="">جميع أنواع المصاريف</option>
            {distinctTapers.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Range selection */}
          <select
            value={selectedRange}
            onChange={e => setSelectedRange(e.target.value)}
            className="bg-[#0d1426] border border-white/10 text-xs rounded-xl px-3 py-2 text-white h-9"
          >
            <option value="all">كل الأوقات</option>
            <option value="today">اليوم</option>
            <option value="month">هذا الشهر</option>
          </select>
        </div>

        <div className="flex gap-2 w-full md:w-auto justify-end shrink-0">
          <button
            onClick={handleReset}
            title="إلغاء تصفية المصاريف"
            className="p-2 bg-white/5 border border-white/5 hover:bg-white/10 rounded-xl text-gray-300 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          
          <button
            onClick={onAddExpense}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg shadow-blue-900/20"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل مصروفات جديد</span>
          </button>
        </div>
      </div>

      {/* Main Expenses listing table */}
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
                <th onClick={() => handleSort("Prix")} className="px-6 py-4 cursor-pointer hover:bg-white/[0.05] transition-colors text-emerald-400">
                  <div className="flex items-center gap-1 justify-start">
                    <span>القيمة</span>
                    {renderSortIcon("Prix")}
                  </div>
                </th>
                <th onClick={() => handleSort("Taper")} className="px-6 py-4 cursor-pointer hover:bg-white/[0.05] transition-colors font-sans text-gray-200">
                  <div className="flex items-center gap-1 justify-start">
                    <span>المصروف</span>
                    {renderSortIcon("Taper")}
                  </div>
                </th>
                <th className="px-6 py-4 text-center">
                  <span>خيارات</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-gray-200 font-sans">
              {sortedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-gray-500 font-medium">
                    لا تتوفر مصاريف مسجلة أو مطابقة في نطاق التصفية
                  </td>
                </tr>
              ) : (
                sortedExpenses.map((exp, idx) => (
                  <tr key={exp.ID || idx} className="hover:bg-white/[0.02] transition-colors">
                    {/* ID */}
                    <td className="px-6 py-4 font-mono font-bold text-blue-400 tracking-wide">
                      {exp.ID}
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4 font-mono text-gray-400">
                      {formatDateDisplay(exp.date)}
                    </td>

                    {/* Prix Value */}
                    <td className="px-6 py-4 font-mono text-sm font-bold text-rose-400">
                      {formatCurrency(exp.Prix || 0)}
                    </td>

                    {/* Description Taper */}
                    <td className="px-6 py-4 text-gray-100 font-semibold truncate max-w-[200px]">
                      {exp.Taper}
                    </td>

                    {/* Edit button */}
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => onEditExpense(exp)}
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

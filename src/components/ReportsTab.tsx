import React from "react";
import { Order, Purchase, Expense } from "../types";
import { DashboardCharts } from "./DashboardCharts";
import { MonthlyTrendsChart } from "./MonthlyTrendsChart";
import { formatCurrency } from "../data";
import { BarChart3, TrendingUp, Calendar, AlertTriangle, ShieldCheck, XCircle } from "lucide-react";

interface ReportsTabProps {
  sales: Order[];
  purchases: Purchase[];
  expenses: Expense[];
}

export const ReportsTab: React.FC<ReportsTabProps> = ({ sales, purchases, expenses }) => {
  // Compute key reporting metrics
  const totalDeliveredRevenue = sales.reduce((acc, s) => s.delivery === "Delivered" ? acc + (s["Total price"] || 0) : acc, 0);
  const totalDeliveredProfit = sales.reduce((acc, s) => s.delivery === "Delivered" ? acc + (s["Bénéfice"] || 0) : acc, 0);
  
  // Delivered count
  const deliveredCount = sales.filter(s => s.delivery === "Delivered").length;
  
  // Return / Returned counts
  const retourCount = sales.filter(s => s.delivery === "Retour").length;

  // Billable count excludes any cancellation status (annuler + 3 new cancellaton statuses as per Section 9 Rule 22)
  const cancellationStatuses = ["annuler", "Client Injoignable", "Annulé Au Téléphone", "Annulé Sur Place"];
  
  // Cancelled count
  const cancelledCount = sales.filter(s => cancellationStatuses.includes(s.delivery)).length;

  const totalCount = sales.length;

  // Delivery Percent = Delivered / (Delivered + Retour + Cancelled) or simple Delivered / Total orders
  const deliveryPct = totalCount > 0 ? (deliveredCount / totalCount) * 100 : 0;

  // Top products
  const topProductCounts: { [code: string]: number } = {};
  sales.forEach(s => {
    if (s["Product name"]) {
      topProductCounts[s["Product name"]] = (topProductCounts[s["Product name"]] || 0) + 1;
    }
  });
  const topProductsSorted = Object.entries(topProductCounts)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Top active cities
  const topCityCounts: { [city: string]: number } = {};
  sales.forEach(s => {
    if (s.City) {
      topCityCounts[s.City] = (topCityCounts[s.City] || 0) + 1;
    }
  });
  const topCitiesSorted = Object.entries(topCityCounts)
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="space-y-6 text-right animate-fade-in" dir="rtl">
      {/* 4 Custom elegant reporting stat indicators */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Metric 1: Condition distribution */}
        <div className="bg-[#111930]/60 border border-white/5 p-5 rounded-2xl relative overflow-hidden glass-effect">
          <div className="text-gray-400 text-xs font-medium flex items-center gap-1.5 mb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>عدد الطلبات الموصولة بالكامل (قيد الرصد)</span>
          </div>
          <div className="text-xl font-bold font-mono text-white">{deliveredCount} طلب</div>
          <p className="text-[10px] text-gray-500 mt-1 font-sans">
            بنسبة نجاح استلام <span className="text-emerald-400 font-bold">{deliveryPct.toFixed(1)}%</span> من إجمالي الطلبات
          </p>
        </div>

        {/* Metric 2: Cancelled Count */}
        <div className="bg-[#111930]/60 border border-white/5 p-5 rounded-2xl relative overflow-hidden glass-effect">
          <div className="text-gray-400 text-xs font-medium flex items-center gap-1.5 mb-2">
            <XCircle className="w-4 h-4 text-red-400" />
            <span>إجمالي الطلبيات الملغاة (كل الحالات)</span>
          </div>
          <div className="text-xl font-bold font-mono text-red-400">{cancelledCount} طلبات ملاذ</div>
          <p className="text-[10px] text-gray-500 mt-1">
            موزعة على الشحن الملغي، الهاتف، وغير الموجودين
          </p>
        </div>

        {/* Metric 3: Top Products leader */}
        <div className="bg-[#111930]/60 border border-white/5 p-5 rounded-2xl relative overflow-hidden glass-effect">
          <div className="text-gray-400 text-xs font-medium flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span>المنتج الأكثر طلباً بالمنظومة</span>
          </div>
          <div className="text-xl font-bold text-white truncate">
            {topProductsSorted[0] ? topProductsSorted[0].code : "غير متوفر"}
          </div>
          <p className="text-[10px] text-gray-500 mt-1">
            بعدد طلبات قدره <span className="text-blue-400 font-bold font-mono">{topProductsSorted[0] ? topProductsSorted[0].count : 0}</span> طلب
          </p>
        </div>

        {/* Metric 4: Top City leader */}
        <div className="bg-[#111930]/60 border border-white/5 p-5 rounded-2xl relative overflow-hidden glass-effect">
          <div className="text-gray-400 text-xs font-medium flex items-center gap-1.5 mb-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <span>المدينة الأكثر جذباً لحركة الملاحة</span>
          </div>
          <div className="text-xl font-bold text-cyan-400 truncate">
            {topCitiesSorted[0] ? topCitiesSorted[0].city : "غير متوفر"}
          </div>
          <p className="text-[10px] text-gray-500 mt-1">
            بعدد شحنات قدره <span className="text-cyan-400 font-semibold font-mono">{topCitiesSorted[0] ? topCitiesSorted[0].count : 0}</span>
          </p>
        </div>
      </div>

      {/* Visual lists for top products and top cities */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top 5 Products Details */}
        <div className="bg-[#111930]/65 border border-white/5 rounded-2xl p-5 shadow-xl glass-effect">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            أعلى 5 منتجات مبيعاً وأكثر طلباً
          </h3>
          <div className="space-y-3 font-sans">
            {topProductsSorted.map((prod, idx) => (
              <div key={prod.code} className="flex justify-between items-center p-2.5 bg-white/5 rounded-xl border border-white/5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-400 font-bold font-mono text-[10px] flex items-center justify-center">#{idx + 1}</span>
                  <span className="text-sm font-bold text-gray-100 font-mono uppercase">{prod.code}</span>
                </div>
                <span className="text-xs text-gray-400 font-mono font-bold">{prod.count} طلبيات</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top 5 Cities Ordered */}
        <div className="bg-[#111930]/65 border border-white/5 rounded-2xl p-5 shadow-xl glass-effect">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-500" />
            أعلى 5 مدن مغربية في حركة المشتريات
          </h3>
          <div className="space-y-3 font-sans">
            {topCitiesSorted.map((city, idx) => (
              <div key={city.city} className="flex justify-between items-center p-2.5 bg-white/5 rounded-xl border border-white/5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/10 text-cyan-400 font-bold font-mono text-[10px] flex items-center justify-center">#{idx + 1}</span>
                  <span className="text-sm font-bold text-gray-100">{city.city}</span>
                </div>
                <span className="text-xs text-gray-400 font-mono font-bold">{city.count} طلبيات</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Line Chart breakdown (Section 9) */}
      <MonthlyTrendsChart sales={sales} />

      {/* Main Charts block */}
      <DashboardCharts sales={sales} purchases={purchases} expenses={expenses} />
    </div>
  );
};

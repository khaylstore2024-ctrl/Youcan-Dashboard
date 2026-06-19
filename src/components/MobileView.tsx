import React, { useState } from "react";
import { Order, Purchase, Payment, Expense } from "../types";
import { MOROCCAN_CITIES, CONDITIONS, DELIVERY_STATUSES, LIVREURS, formatCurrency, formatDateDisplay, generateWhatsAppUrl, validatePhone, getCalculatedFields, KHAYL_WHATSAPP_MESSAGE } from "../data";
import { Home, Users, Package, CreditCard, MoreHorizontal, ShieldCheck, TrendingUp, AlertTriangle, Sprout, ShoppingCart, Info, Search, Plus, Filter, Phone, PhoneCall, MessageCircle, X, ChevronDown, Check, Coins, Calendar, RefreshCcw, LogOut } from "lucide-react";

// Robust date parser to handle DD/MM/YYYY, YYYY-MM-DD, standard formats, or Date objects
function parseDateToTime(dateStr: any): number {
  if (!dateStr) return 0;
  if (dateStr instanceof Date) return dateStr.getTime();
  const str = String(dateStr).trim();
  if (!str) return 0;
  
  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    return new Date(year, month, day).getTime();
  }
  
  // Try YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    return new Date(year, month, day).getTime();
  }
  
  const parsed = Date.parse(str);
  return isNaN(parsed) ? 0 : parsed;
}

interface MobileViewProps {
  sales: Order[];
  purchases: Purchase[];
  payments: Payment[];
  expenses: Expense[];
  onAddSale: (newSale: Order) => void;
  onUpdateOrder: (rowNum: number, updates: any) => void;
  onAddExpense: (newExpense: Expense) => void;
  onSync?: () => void;
  onLogout?: () => void;
  isSyncing?: boolean;
  onAddPurchase?: () => void;
  onAddPayment?: () => void;
}

export const MobileView: React.FC<MobileViewProps> = ({ 
  sales, 
  purchases, 
  payments, 
  expenses, 
  onAddSale, 
  onUpdateOrder, 
  onAddExpense,
  onSync,
  onLogout,
  isSyncing = false,
  onAddPurchase,
  onAddPayment
}) => {
  const distinctCities = React.useMemo(() => {
    return Array.from(new Set(sales.map(s => s.City).filter(Boolean))) as string[];
  }, [sales]);
  const cityOptions = distinctCities.length > 0 ? distinctCities : MOROCCAN_CITIES;

  const distinctLivreurs = React.useMemo(() => {
    return Array.from(new Set(sales.map(s => s.Livreur).filter(Boolean))) as string[];
  }, [sales]);
  const livreurOptions = distinctLivreurs.length > 0 ? distinctLivreurs : LIVREURS;

  const productOptions = React.useMemo(() => {
    return Array.from(new Set([
      ...purchases.map(p => p.Code),
      ...sales.map(s => s["Product name"])
    ].filter(Boolean))) as string[];
  }, [purchases, sales]);

  const expenseTapersOptions = React.useMemo(() => {
    return Array.from(new Set(expenses.map(e => e.Taper).filter(Boolean))) as string[];
  }, [expenses]);
  const finalExpenseTapers = expenseTapersOptions.length > 0 ? expenseTapersOptions : ["إعلانات انستغرام", "إعلانات فيسبوك", "مصاريف شحن", "مصاريف عامة"];

  // Comprehensive Mobile Dashboard Analytics KPIs
  const mobileReportsStats = React.useMemo(() => {
    const totalOrders = sales.length;

    // Delivered metrics count & percentage
    const delivered = sales.filter(s => s.delivery === "Delivered").length;
    const deliveryRate = totalOrders > 0 ? (delivered / totalOrders) * 100 : 0;

    // Total sales amount overall & delivered
    const totalSalesAmount = sales.reduce((acc, s) => acc + (s["Total price"] || 0), 0);
    const totalDeliveredRevenue = sales.reduce((acc, s) => s.delivery === "Delivered" ? acc + (s["Total price"] || 0) : acc, 0);

    // Total profits (sum of 'Bénéfice' column)
    const totalProfitAll = sales.reduce((acc, s) => acc + (s["Bénéfice"] || 0), 0);
    const totalProfitDelivered = sales.reduce((acc, s) => s.delivery === "Delivered" ? acc + (s["Bénéfice"] || 0) : acc, 0);

    // Total expenses
    const totalExpenses = expenses.reduce((acc, ex) => acc + (ex.Prix || 0), 0);

    // Net Project profit (Delivered benefit - Total Expenses)
    const netProfitVal = totalProfitDelivered - totalExpenses;

    // Cost per Sale (Total Expenses / Delivered count)
    const costPerSale = delivered > 0 ? totalExpenses / delivered : 0;

    // Cost of purchases
    const totalPurchasesCost = purchases.reduce((acc, p) => acc + (p.total || 0), 0);

    // Payments to suppliers
    const totalPaymentsToSuppliers = payments.reduce((acc, pay) => acc + (pay.Payment || 0), 0);

    // Remaining outstanding supplier dept
    const remainingSupplierBalance = totalPurchasesCost - totalPaymentsToSuppliers;

    // Aggregated suppliers list: cost of purchases, payments made, and remaining balance
    const suppliersMap: { [name: string]: { name: string; totalPurchases: number; totalPayments: number; balance: number } } = {};
    purchases.forEach(p => {
      const s = p.Fournisseur || "غير محدد";
      if (!suppliersMap[s]) {
        suppliersMap[s] = { name: s, totalPurchases: 0, totalPayments: 0, balance: 0 };
      }
      suppliersMap[s].totalPurchases += (p.total || 0);
    });

    payments.forEach(pay => {
      const s = pay.Fournisseur || "غير محدد";
      if (!suppliersMap[s]) {
        suppliersMap[s] = { name: s, totalPurchases: 0, totalPayments: 0, balance: 0 };
      }
      suppliersMap[s].totalPayments += (pay.Payment || 0);
    });

    const suppliersList = Object.values(suppliersMap).map(s => ({
      ...s,
      balance: s.totalPurchases - s.totalPayments
    })).sort((a, b) => b.totalPurchases - a.totalPurchases);

    // Top 5 Moroccan Cities
    const cityCount: { [city: string]: number } = {};
    sales.forEach(s => {
      const city = s.City ? s.City.trim() : "";
      if (city) {
        cityCount[city] = (cityCount[city] || 0) + 1;
      }
    });
    const topCities = Object.entries(cityCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([city, count]) => ({
        city,
        count,
        percentage: totalOrders > 0 ? (count / totalOrders) * 100 : 0
      }));

    // Top Selling Product
    const prodCount: { [prod: string]: { name: string; qtyRequested: number; qtySold: number } } = {};
    sales.forEach(s => {
      const prod = s["Product name"] ? s["Product name"].trim() : "";
      if (prod) {
        if (!prodCount[prod]) {
          prodCount[prod] = { name: prod, qtyRequested: 0, qtySold: 0 };
        }
        const qty = s["Total quantity"] || 1;
        prodCount[prod].qtyRequested += qty;
        if (s.delivery === "Delivered") {
          prodCount[prod].qtySold += qty;
        }
      }
    });
    const sortedProds = Object.values(prodCount).sort((a, b) => b.qtyRequested - a.qtyRequested);
    const topProduct = sortedProds.length > 0 ? sortedProds[0] : null;

    return {
      totalOrders,
      delivered,
      deliveryRate,
      totalSalesAmount,
      totalDeliveredRevenue,
      totalProfitAll,
      totalProfitDelivered,
      totalExpenses,
      netProfit: netProfitVal,
      costPerSale,
      totalPurchasesCost,
      totalPaymentsToSuppliers,
      remainingSupplierBalance,
      suppliersList,
      topCities,
      topProduct,
      allProductsList: sortedProds
    };
  }, [sales, purchases, payments, expenses]);

  const [activePage, setActivePage] = useState<"home" | "sales" | "purchases" | "payments" | "more">("home");
  const [moreSubTab, setMoreSubTab] = useState<"reports" | "expenses" | "settings">("reports");
  const [isSuppliersReportExpanded, setIsSuppliersReportExpanded] = useState(false);
  const [isTopCitiesExpanded, setIsTopCitiesExpanded] = useState(false);
  const [isAllProductsReportExpanded, setIsAllProductsReportExpanded] = useState(false);
  const [isSalesOrdersReportExpanded, setIsSalesOrdersReportExpanded] = useState(false);

  // Search & Filter state
  const [salesSearch, setSalesSearch] = useState("");
  const [selectedCondition, setSelectedCondition] = useState("");
  const [selectedDelivery, setSelectedDelivery] = useState("");
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  // Detail Modal popup for a specific order
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<Order | null>(null);

  // Add Sale Modal popup
  const [isAddSaleOpen, setIsAddSaleOpen] = useState(false);
  const [newSaleForm, setNewSaleForm] = useState({
    "Full name": "",
    "Phone": "",
    "City": "",
    "Region": "",
    "Product name": "",
    "Variant price": "" as any,
    "Product URL": "",
    "Total quantity": "" as any,
    "Product variant": "",
    "Condition": "",
    "delivery": "",
    "Livreur": ""
  });

  // Expense popup launcher
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [newExpenseForm, setNewExpenseForm] = useState({
    "Prix": "" as any,
    "Taper": ""
  });

  const [phoneError, setPhoneError] = useState("");

  const handleProductSelect = (code: string) => {
    const parent = purchases.find(p => p.Code && p.Code.toUpperCase() === code.toUpperCase());
    setNewSaleForm(prev => ({
      ...prev,
      "Product name": code,
      "Variant price": parent ? parent["Prix de vente"] : 0,
      "Product URL": parent ? `https://yourstore.com/products/${code.toLowerCase()}` : ""
    }));
  };

  // Recent 10 Orders List
  const recentOrders = [...sales].sort((a,b) => {
    return parseDateToTime(b["Order date"]) - parseDateToTime(a["Order date"]);
  }).slice(0, 10);

  // Compute stats including 3 new delivery statuses
  const totalOrdersCount = sales.length;
  // Delivered count
  const deliveredCount = sales.filter(s => s.delivery === "Delivered").length;
  // Retour count
  const retourCount = sales.filter(s => s.delivery === "Retour").length;

  // Cancellation conditions includes all 4 indices (annuler + 3 new cancellation statuses grouped)
  const cancellationStatuses = ["annuler", "Client Injoignable", "Annulé Au Téléphone", "Annulé Sur Place"];
  const cancelledCount = sales.filter(s => cancellationStatuses.includes(s.delivery)).length;

  const totalDeliveredRevenue = sales.reduce((acc, s) => s.delivery === "Delivered" ? acc + (s["Total price"] || 0) : acc, 0);
  const totalDeliveredProfit = sales.reduce((acc, s) => s.delivery === "Delivered" ? acc + (s["Bénéfice"] || 0) : acc, 0);
  const totalExpensesSum = expenses.reduce((acc, ex) => acc + (ex.Prix || 0), 0);
  
  // Net Profit = Σ(Bénéfice) - Σ(Expenses.Prix)
  const netProfit = totalDeliveredProfit - totalExpensesSum;

  const handleCreateSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePhone(newSaleForm.Phone)) {
      setPhoneError("رقم الهاتف غير صحيح (يجب أن يبدأ بـ 0 ويتكون من 10 أرقام)");
      return;
    }
    setPhoneError("");

    const orderId = `WSP-${String(sales.length + 1001).padStart(4, "0")}`;
    const dateToday = new Date().toISOString().split("T")[0];
    
    // Automatically calculate price on Delivered and supplier info
    const calcs = getCalculatedFields(
      newSaleForm["Product name"],
      parseFloat(newSaleForm["Variant price"]) || 0,
      parseFloat(newSaleForm["Total quantity"]) || 0,
      newSaleForm.delivery,
      purchases
    );

    const fullNewSale: Order = {
      _rowNum: sales.length + 2,
      "Order ID": orderId,
      "Order date": dateToday,
      "Full name": newSaleForm["Full name"],
      "Phone": newSaleForm.Phone,
      "City": newSaleForm.City,
      "Region": newSaleForm.Region,
      "Product name": newSaleForm["Product name"],
      "Product URL": newSaleForm["Product URL"],
      "Variant price": parseFloat(newSaleForm["Variant price"]) || 0,
      "Total quantity": parseFloat(newSaleForm["Total quantity"]) || 0,
      "Product variant": newSaleForm["Product variant"] || "",
      "Total price": newSaleForm.delivery === "Delivered" ? (parseFloat(newSaleForm["Variant price"]) || 0) * (parseFloat(newSaleForm["Total quantity"]) || 0) : 0,
      "Condition": newSaleForm.Condition,
      "Livreur": newSaleForm.Livreur,
      "delivery": newSaleForm.delivery,
      "WhatsApp Sent": "لا",
      "WhatsApp Count": 0,
      ...calcs
    };

    onAddSale(fullNewSale);
    setIsAddSaleOpen(false);
    // Reset form
    setNewSaleForm({
      "Full name": "",
      "Phone": "",
      "City": "",
      "Region": "",
      "Product name": "",
      "Variant price": "" as any,
      "Product URL": "",
      "Total quantity": "" as any,
      "Product variant": "",
      "Condition": "",
      "delivery": "",
      "Livreur": ""
    });
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const expId = `EXP-${String(expenses.length + 101).padStart(3, "0")}`;
    const dateToday = new Date().toISOString().split("T")[0];

    const expObj: Expense = {
      _rowNum: expenses.length + 2,
      ID: expId,
      date: dateToday,
      Prix: parseFloat(newExpenseForm.Prix) || 0,
      Taper: newExpenseForm.Taper
    };

    onAddExpense(expObj);
    setIsAddExpenseOpen(false);
    setNewExpenseForm({ Prix: "" as any, Taper: "" });
  };

  // Detail Modal Inline Save recurrence (recalls statistics immediately)
  const handleDetailUpdate = (rowNum: number, field: string, value: any, currentSale: Order) => {
    const updatedObj = { ...currentSale, [field]: value };
    const calcs = getCalculatedFields(
      updatedObj["Product name"],
      updatedObj["Variant price"],
      updatedObj["Total quantity"],
      updatedObj.delivery,
      purchases
    );

    const priceRecalc = updatedObj.delivery === "Delivered" ? updatedObj["Variant price"] * updatedObj["Total quantity"] : 0;
    
    const updates = {
      [field]: value,
      "Total price": priceRecalc,
      ...calcs
    };

    onUpdateOrder(rowNum, updates);

    // Dynamic state feed inside detail open modal
    setSelectedOrderDetail(prev => {
      if (!prev) return null;
      return {
        ...prev,
        ...updates
      } as Order;
    });
  };

  // Filter Sales list for mobile UI
  const filteredSalesList = sales.filter(s => {
    const matchesSearch = !salesSearch ? true : (
      (s["Order ID"] || "").toLowerCase().includes(salesSearch.toLowerCase()) ||
      (s["Full name"] || "").toLowerCase().includes(salesSearch.toLowerCase()) ||
      (s["Phone"] || "").toLowerCase().includes(salesSearch.toLowerCase())
    );

    const matchesCond = !selectedCondition ? true : s.Condition === selectedCondition;
    const matchesDeliv = !selectedDelivery ? true : s.delivery === selectedDelivery;

    return matchesSearch && matchesCond && matchesDeliv;
  }).sort((a, b) => {
    return parseDateToTime(b["Order date"]) - parseDateToTime(a["Order date"]);
  });

  return (
    <div className="w-full max-w-md mx-auto min-h-screen bg-[#070a13] relative flex flex-col font-sans" dir="rtl">
      {/* Screen container */}
      <div className="flex-grow flex flex-col pt-4 pb-20">
        
        {/* VIEW 1: HOME PAGE */}
        {activePage === "home" && (
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 h-full" id="pageHome">
            {/* Header branding */}
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-gray-500 text-[10px] block">لوحة تحكم اليوكان</span>
                <span className="text-sm font-bold text-white font-sans flex items-center gap-1.5">
                  مراقبة المبيعات الهاتفية
                  <span className="text-[10px] py-0.5 px-2 rounded-full bg-blue-600/20 text-blue-400 font-bold border border-blue-500/10">مباشر</span>
                </span>
              </div>
              <button onClick={() => setIsAddSaleOpen(true)} className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors shadow">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Quick KPIs Summary Ring banner */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#111930]/60 border border-white/5 p-4 rounded-xl relative glass-effect">
                <div className="text-gray-400 text-[10px] mb-0.5 font-medium">إجمالي الاستلام (مستلم)</div>
                <div className="text-sm font-bold font-mono text-emerald-400">{formatCurrency(totalDeliveredRevenue)}</div>
                <p className="text-[9px] text-gray-500 mt-0.5">منصف {deliveredCount} طلبات موصلة</p>
              </div>
              <div className="bg-[#111930]/60 border border-white/5 p-4 rounded-xl relative glass-effect">
                <div className="text-gray-400 text-[10px] mb-0.5 font-medium">حساب صافي الأرباح</div>
                <div className={`text-sm font-bold font-mono ${netProfit >= 0 ? "text-blue-400" : "text-rose-400"}`}>{formatCurrency(netProfit)}</div>
                <p className="text-[9px] text-gray-500 mt-0.5">بعد خصم تكاليف المشروع</p>
              </div>
            </div>

            {/* 4 KPI status counts */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-emerald-950/20 border border-emerald-500/10 p-2.5 rounded-lg flex flex-col justify-center items-center">
                <span className="text-[9px] text-gray-400 mb-0.5 font-medium">المستلمة</span>
                <span className="font-bold text-emerald-400 font-mono text-xs">{deliveredCount}</span>
              </div>
              <div className="bg-amber-950/20 border border-amber-500/10 p-2.5 rounded-lg flex flex-col justify-center items-center">
                <span className="text-[9px] text-gray-400 mb-0.5 font-medium">المرتجعة</span>
                <span className="font-bold text-amber-400 font-mono text-xs">{retourCount}</span>
              </div>
              <div className="bg-rose-950/20 border border-rose-500/10 p-2.5 rounded-lg flex flex-col justify-center items-center">
                <span className="text-[9px] text-gray-400 mb-0.5 font-medium">الملغاة</span>
                <span className="font-bold text-red-400 font-mono text-xs">{cancelledCount}</span>
              </div>
              <div className="bg-blue-950/20 border border-blue-500/10 p-2.5 rounded-lg flex flex-col justify-center items-center">
                <span className="text-[9px] text-gray-400 mb-0.5 font-medium">المجموع</span>
                <span className="font-bold text-blue-400 font-mono text-xs">{totalOrdersCount}</span>
              </div>
            </div>

            {/* Recent Orders Preview Header */}
            <div>
              <div className="flex justify-between items-center mb-2.5">
                <span className="text-xs font-bold text-gray-200">آخر 10 عمليات تسجيل بالشرق</span>
                <span className="text-[10px] text-blue-400 hover:underline cursor-pointer" onClick={() => setActivePage("sales")}>عرض الكل ←</span>
              </div>

              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-0.5">
                {recentOrders.map((ord, i) => (
                  <div
                    key={ord["Order ID"] + i}
                    onClick={() => setSelectedOrderDetail(ord)}
                    className="p-3 bg-[#111930]/40 border border-white/5 rounded-xl hover:bg-white/5 transition-all cursor-pointer flex justify-between items-center"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="font-mono text-blue-400 font-bold text-xs uppercase">{ord["Order ID"]}</span>
                        <span className="text-[9px] text-gray-400 font-medium truncate max-w-[100px]">{ord["Full name"]}</span>
                      </div>
                      <span className="font-semibold text-gray-200 text-xs block truncate max-w-[150px] uppercase font-mono">{ord["Product name"]}</span>
                    </div>

                    <div className="text-left">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border block mb-1 ${
                        ord.delivery === "Delivered" 
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                          : ["Retour", "annuler", "Client Injoignable", "Annulé Au Téléphone", "Annulé Sur Place"].includes(ord.delivery)
                          ? "bg-red-500/10 text-rose-400 border-red-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}>
                        {ord.delivery || ord.Condition || "معلق"}
                      </span>
                      <span className="text-[11px] font-mono font-bold text-gray-300">{formatCurrency(ord.delivery === "Delivered" ? (ord["Variant price"] * ord["Total quantity"]) : 0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* VIEW 2: SALES PAGE */}
        {activePage === "sales" && (
          <div className="flex-1 overflow-hidden flex flex-col p-4 h-full" id="pageSales">
            {/* Header search / Filter bar */}
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="ابحث برقم الطلب ، اسم العميل..."
                  value={salesSearch}
                  onChange={e => setSalesSearch(e.target.value)}
                  className="w-full bg-[#0d1426] border border-white/10 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white"
                />
                <Search className="w-3.5 h-3.5 text-gray-500 absolute right-3 top-2.5" />
              </div>
              <button
                onClick={() => setIsFilterSheetOpen(true)}
                className="p-2 bg-white/5 border border-white/5 rounded-xl text-gray-400"
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable list content */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-0.5 min-h-[500px]">
              {filteredSalesList.length === 0 ? (
                <div className="py-20 text-center text-gray-500 text-xs">لا تتوفر طلبيات مطابقة للبحث</div>
              ) : (
                filteredSalesList.map((ord, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedOrderDetail(ord)}
                    className="p-3 bg-[#111930]/40 border border-white/5 rounded-xl hover:bg-white/5 transition-all cursor-pointer flex justify-between items-start"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-blue-400 font-bold text-xs uppercase">{ord["Order ID"]}</span>
                        <span className="text-gray-200 font-bold text-xs">{ord["Full name"]}</span>
                      </div>
                      <span className="text-[11px] text-gray-400 block font-mono">{ord.Phone}</span>
                      <span className="text-[11px] text-gray-400 block">{ord.City} • {ord.Region || ord.City}</span>
                      
                      <div className="pt-1 flex gap-1 items-center">
                        <span className="px-1.5 py-0.5 bg-white/5 text-[9px] rounded text-gray-300 font-mono uppercase">{ord["Product name"]}</span>
                        <span className="text-[10px] text-gray-500 font-mono">الكمية: {ord["Total quantity"] || 1}</span>
                      </div>
                    </div>

                    <div className="text-left flex flex-col justify-between h-full items-end min-h-[70px]">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                        ord.delivery === "Delivered"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : ["Retour", "annuler", "Client Injoignable", "Annulé Au Téléphone", "Annulé Sur Place"].includes(ord.delivery)
                          ? "bg-red-500/10 text-rose-300 border-red-500/15"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/15"
                      }`}>
                        {ord.delivery || ord.Condition || "غير محدد"}
                      </span>
                      <span className="text-xs font-mono font-bold text-white">{formatCurrency(ord["Variant price"] * ord["Total quantity"])}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: PURCHASES VIEW */}
        {activePage === "purchases" && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 h-full" id="pagePurchases">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">السلع والوارد شحن</h3>
            
            <div className="space-y-3 pb-20">
              {[...purchases]
                .sort((a, b) => parseDateToTime(b.date) - parseDateToTime(a.date))
                .map((p, idx) => (
                <div key={idx} className="p-3 bg-[#111930]/40 border border-white/5 rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-xs font-bold text-white block uppercase font-mono">{p.Produit}</span>
                      <span className="text-[10px] text-gray-500 uppercase font-mono tracking-tight font-semibold">المورد: {p.Fournisseur}</span>
                    </div>
                    <span className="text-[11px] px-2 py-0.5 bg-rose-500/10 text-rose-400 font-bold border border-red-500/15 rounded-full font-mono">{p.Code}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-center font-mono">
                    <div>
                      <span className="text-[9px] text-gray-500 block">الكمية الموفرة</span>
                      <span className="text-xs text-white font-bold">{p.nombre} قطعة</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-500 block">سعر التكلفة</span>
                      <span className="text-xs text-rose-400 font-bold">{formatCurrency(p["Prix Unit"])}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-500 block">البيع المقترح</span>
                      <span className="text-xs text-emerald-400 font-bold">{formatCurrency(p["Prix de vente"])}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 4: PAYMENTS VIEW */}
        {activePage === "payments" && (
          <div className="flex-1 overflow-y-auto p-4 h-full" id="pagePayments">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">حوالات وجدول الدفعات المسددة</h3>
            <div className="space-y-3 pb-20">
              {[...payments]
                .sort((a, b) => parseDateToTime(b.date) - parseDateToTime(a.date))
                .map((pay, idx) => (
                <div key={idx} className="p-3 bg-[#111930]/40 border border-white/5 rounded-xl flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-white block font-mono">{pay.ID}</span>
                    <span className="text-[10px] text-gray-400 block mt-0.5">المستلم: {pay.Fournisseur}</span>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-xs font-bold text-emerald-400 block">{formatCurrency(pay.Payment)}</span>
                    <span className="text-[9px] text-gray-500 block">{formatDateDisplay(pay.date)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 5: MORE TABS (EXPENSES & REPORTS & SETTINGS SUB SECTION) */}
        {activePage === "more" && (
          <div className="flex-1 overflow-hidden flex flex-col h-full" id="pageMore">
            {/* Horizontal Sub selector */}
            <div className="flex border-b border-white/5 bg-[#0d1426] p-1 gap-2 mx-4 mt-2 mb-3 rounded-xl">
              <button
                onClick={() => setMoreSubTab("reports")}
                className={`flex-1 text-center py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-colors ${
                  moreSubTab === "reports" ? "bg-white/5 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                التقارير
              </button>
              <button
                onClick={() => setMoreSubTab("expenses")}
                className={`flex-1 text-center py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-colors ${
                  moreSubTab === "expenses" ? "bg-white/5 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                المصاريف
              </button>
              <button
                onClick={() => setMoreSubTab("settings")}
                className={`flex-1 text-center py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-colors ${
                  moreSubTab === "settings" ? "bg-white/5 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                التهيئة
              </button>
            </div>

            {/* Scrollable Sub view */}
            <div className="flex-1 overflow-y-auto px-4 space-y-4">
              
              {/* SUB A: MOBILE REPORTS */}
              {moreSubTab === "reports" && (
                <div className="space-y-4 animate-fade-in text-right">
                  
                  {/* SECTION 1: SALES & DELIVERY PERFORMANCE */}
                  <div className="p-4 bg-[#111930]/60 border border-white/5 rounded-2xl space-y-3">
                    <button
                      onClick={() => setIsSalesOrdersReportExpanded(!isSalesOrdersReportExpanded)}
                      className="w-full text-right flex justify-between items-center pb-1 border-b border-white/5 cursor-pointer outline-none group"
                    >
                      <h4 className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider group-hover:text-indigo-300 transition-colors flex items-center gap-1.5">
                        <span>تقرير المبيعات والطلبات (الأداء)</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping inline-block"></span>
                      </h4>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-gray-400 font-normal">اضغط للتفاصيل</span>
                        <ChevronDown 
                          className={`w-3.5 h-3.5 text-indigo-400 transition-transform duration-300 ${
                            isSalesOrdersReportExpanded ? "rotate-180" : ""
                          }`} 
                        />
                      </div>
                    </button>

                    {isSalesOrdersReportExpanded && (
                      <div className="space-y-3 animate-fade-in">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-2.5 bg-white/5 rounded-xl text-center">
                            <span className="text-[10px] text-gray-400 block mb-0.5">إجمالي الطلبات</span>
                            <span className="font-mono text-lg font-black text-white">{mobileReportsStats.totalOrders}</span>
                            <span className="text-[9px] text-gray-400 block">طلب مسجل</span>
                          </div>
                          
                          <div className="p-2.5 bg-white/5 rounded-xl text-center">
                            <span className="text-[10px] text-gray-400 block mb-0.5">نسبة التوصيل</span>
                            <span className="font-mono text-lg font-black text-indigo-400">
                              {mobileReportsStats.deliveryRate.toFixed(1)}%
                            </span>
                            <span className="text-[9px] text-gray-500 block">
                              مسلّم: <span className="text-emerald-400 font-bold">{mobileReportsStats.delivered}</span>
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2 pt-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-400">مجموع قيم مبيعات الملف:</span>
                            <span className="font-mono text-white font-bold">{formatCurrency(mobileReportsStats.totalSalesAmount)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-400">قيمة المبيعات المستلمة فـعلياً:</span>
                            <span className="font-mono text-amber-400 font-semibold">{formatCurrency(mobileReportsStats.totalDeliveredRevenue)}</span>
                          </div>
                        </div>

                        {/* Progress Slider */}
                        <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                          <div 
                            className="bg-indigo-500 h-full rounded-full transition-all duration-700" 
                            style={{ width: `${Math.min(mobileReportsStats.deliveryRate, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SECTION 2: FINANCIAL KPI & PROFITABILITY */}
                  <div className="p-4 bg-[#111930]/60 border border-white/5 rounded-2xl space-y-3">
                    <h4 className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider pb-1 border-b border-white/5 flex justify-between items-center">
                      <span>المؤشرات المالية والأرباح العامة</span>
                      <span className="text-[9px] font-normal text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">مباشر</span>
                    </h4>

                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400">مجموع أرباح الملف (Bénéfice):</span>
                        <span className="font-mono text-rose-300 font-bold">{formatCurrency(mobileReportsStats.totalProfitAll)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400">أرباح المبيعات المستلمة:</span>
                        <span className="font-mono text-emerald-400 font-bold">{formatCurrency(mobileReportsStats.totalProfitDelivered)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400">إجمالي المصاريف التشغيلية:</span>
                        <span className="font-mono text-rose-400 font-bold">{formatCurrency(mobileReportsStats.totalExpenses)}</span>
                      </div>

                      <div className="flex justify-between items-center text-xs pt-1 border-t border-white/5">
                        <span className="text-gray-400">تكلفة المبيعة الواحدة:</span>
                        <span className="font-mono text-cyan-400 font-bold">{formatCurrency(mobileReportsStats.costPerSale)}</span>
                      </div>

                      {/* NET ACTUAL PROFIT HERO BOX */}
                      <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex justify-between items-center">
                        <div>
                          <span className="text-[10px] text-blue-300 block font-semibold">صافي الأرباح العام للمشروع</span>
                          <span className="text-[9px] text-gray-500">(أرباح التوصيل مخصوم منها المصاريف)</span>
                        </div>
                        <span className={`font-mono text-base font-black ${mobileReportsStats.netProfit >= 0 ? "text-blue-400" : "text-rose-400"}`}>
                          {formatCurrency(mobileReportsStats.netProfit)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: SUPPLY CHAIN & SUPPLIER LEDGER */}
                  <div className="p-4 bg-[#111930]/60 border border-white/5 rounded-2xl space-y-3">
                    <button
                      onClick={() => setIsSuppliersReportExpanded(!isSuppliersReportExpanded)}
                      className="w-full text-right flex justify-between items-center pb-1 border-b border-white/5 cursor-pointer outline-none group"
                    >
                      <h4 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider group-hover:text-amber-300 transition-colors">
                        حسابات الموردين والمشتريات
                      </h4>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-gray-500 font-normal">اضغط للتفاصيل</span>
                        <ChevronDown 
                          className={`w-3.5 h-3.5 text-amber-400 transition-transform duration-300 ${
                            isSuppliersReportExpanded ? "rotate-180" : ""
                          }`} 
                        />
                      </div>
                    </button>

                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400">تكلفة المشتريات (إجمالي الفواتير):</span>
                        <span className="font-mono text-amber-100 font-bold">{formatCurrency(mobileReportsStats.totalPurchasesCost)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400">إجمالي المدفوعات للموردين:</span>
                        <span className="font-mono text-emerald-400 font-semibold">{formatCurrency(mobileReportsStats.totalPaymentsToSuppliers)}</span>
                      </div>
                      
                      <div className="border-t border-white/5 pt-2 flex justify-between items-center text-xs pb-1">
                        <span className="text-white font-bold">باقي الرصيد بذمة الموردين:</span>
                        <span className={`font-mono text-sm font-black ${mobileReportsStats.remainingSupplierBalance > 0 ? "text-rose-400" : "text-gray-300"}`}>
                          {formatCurrency(mobileReportsStats.remainingSupplierBalance)}
                        </span>
                      </div>

                      {/* Expandable supplier itemized ledger */}
                      {isSuppliersReportExpanded && (
                        <div className="pt-2.5 border-t border-white/5 space-y-2 animate-fade-in">
                          <div className="text-[10px] font-bold text-indigo-400 mb-1 flex justify-between items-center">
                            <span>تفصيل حسابات كل مورّد:</span>
                            <span className="text-[9px] text-gray-500">مجموع: {mobileReportsStats.suppliersList.length}</span>
                          </div>
                          
                          {mobileReportsStats.suppliersList.length === 0 ? (
                            <div className="text-center text-xs text-gray-500 py-2">لا توجد تفاصيل موردين حالياً</div>
                          ) : (
                            mobileReportsStats.suppliersList.map((sup, sIdx) => (
                              <div key={sIdx} className="p-2.5 bg-black/20 rounded-xl space-y-1.5 border border-white/[0.02]">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-indigo-300 font-bold">{sup.name}</span>
                                  <span className={`font-mono font-bold text-[11px] ${sup.balance > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                                    {sup.balance > 0 ? `باقي: ${formatCurrency(sup.balance)}` : "مسدد بالكامل"}
                                  </span>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2 text-[10px]">
                                  <div className="flex justify-between bg-white/[0.02] p-1.5 rounded">
                                    <span className="text-gray-400">تكلفة المشتريات:</span>
                                    <span className="font-mono text-white">{formatCurrency(sup.totalPurchases)}</span>
                                  </div>
                                  <div className="flex justify-between bg-white/[0.02] p-1.5 rounded">
                                    <span className="text-gray-400">المدفوعات:</span>
                                    <span className="font-mono text-emerald-400">{formatCurrency(sup.totalPayments)}</span>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SECTION 4: TOP WINNERS & GEO DEMOGRAPHICS */}
                  <div className="grid grid-cols-1 gap-4">
                    {/* TOP PRODUCT CARD */}
                    {mobileReportsStats.topProduct && (
                      <div className="p-4 bg-[#111930]/60 border border-white/5 rounded-2xl space-y-3">
                        <h4 className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider pb-1 border-b border-white/5 flex items-center justify-between">
                          <span>المنتوج الأكثر طلباً</span>
                          <span className="text-[10px] bg-cyan-400/10 text-cyan-400 px-2 py-0.5 rounded font-mono">المرتبة #1</span>
                        </h4>
                        <div className="flex flex-col gap-2">
                          <span className="text-white font-bold text-sm tracking-tight">{mobileReportsStats.topProduct.name}</span>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                            <div className="bg-white/5 p-2 rounded-xl flex flex-col justify-center items-center">
                              <span className="text-[10px] text-gray-400">الوحدات المطلوبة</span>
                              <span className="font-mono text-cyan-400 font-black text-sm mt-0.5">
                                {mobileReportsStats.topProduct.qtyRequested}
                              </span>
                            </div>
                            <div className="bg-white/5 p-2 rounded-xl flex flex-col justify-center items-center">
                              <span className="text-[10px] text-gray-400">الوحدات المباعة</span>
                              <span className="font-mono text-emerald-400 font-black text-sm mt-0.5">
                                {mobileReportsStats.topProduct.qtySold}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="p-4 bg-[#111930]/60 border border-white/5 rounded-2xl space-y-2.5">
                      <button
                        onClick={() => setIsTopCitiesExpanded(!isTopCitiesExpanded)}
                        className="w-full text-right flex justify-between items-center pb-1 border-b border-white/5 cursor-pointer outline-none group"
                      >
                        <h4 className="text-[11px] font-bold text-purple-400 uppercase tracking-wider group-hover:text-purple-300 transition-colors">
                          المدن الـ 5 الأكثر طلباً في المغرب
                        </h4>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-gray-500 font-normal font-sans">اضغط للتفاصيل</span>
                          <ChevronDown 
                            className={`w-3.5 h-3.5 text-purple-400 transition-transform duration-300 ${
                              isTopCitiesExpanded ? "rotate-180" : ""
                            }`} 
                          />
                        </div>
                      </button>
                      
                      {isTopCitiesExpanded && (
                        <div className="space-y-2 pt-1 animate-fade-in">
                          {mobileReportsStats.topCities.length === 0 ? (
                            <div className="text-center text-xs text-gray-500 py-2">لا توجد بيانات كافية حالياً</div>
                          ) : (
                            mobileReportsStats.topCities.map((item, idx) => (
                              <div key={idx} className="space-y-1">
                                <div className="flex justify-between items-center text-xs font-mono">
                                  <span className="text-gray-200 font-bold font-sans">
                                    {idx + 1}. {item.city}
                                  </span>
                                  <span className="text-gray-400 text-[11px]">
                                    {item.count} طلب ({item.percentage.toFixed(1)}%)
                                  </span>
                                </div>
                                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-purple-500 h-full rounded-full transition-all duration-700"
                                    style={{ width: `${item.percentage}%` }}
                                  ></div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* ALL PRODUCTS TOTALS REPORT */}
                    <div className="p-4 bg-[#111930]/60 border border-white/5 rounded-2xl space-y-2.5">
                      <button
                        onClick={() => setIsAllProductsReportExpanded(!isAllProductsReportExpanded)}
                        className="w-full text-right flex justify-between items-center pb-1 border-b border-white/5 cursor-pointer outline-none group"
                      >
                        <h4 className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider group-hover:text-cyan-300 transition-colors">
                          تقرير مبيعات وطلبات كافة المنتجات
                        </h4>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-gray-500 font-normal font-sans">مجموع: {mobileReportsStats.allProductsList.length}</span>
                          <ChevronDown 
                            className={`w-3.5 h-3.5 text-cyan-400 transition-transform duration-300 ${
                              isAllProductsReportExpanded ? "rotate-180" : ""
                            }`} 
                          />
                        </div>
                      </button>
                      
                      {isAllProductsReportExpanded && (
                        <div className="space-y-2.5 pt-1 animate-fade-in">
                          {mobileReportsStats.allProductsList.length === 0 ? (
                            <div className="text-center text-xs text-gray-500 py-2">لا توجد بيانات منتوجات حالياً</div>
                          ) : (
                            mobileReportsStats.allProductsList.map((prod, idx) => (
                              <div key={idx} className="p-2.5 bg-white/[0.02] border border-white/[0.04] rounded-xl space-y-2 transition-all hover:bg-white/[0.04]">
                                <div className="flex justify-between items-center">
                                  <span className="text-white font-bold text-xs tracking-tight">{prod.name}</span>
                                  <span className="text-[9px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded font-mono">#{idx + 1}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                                  <div className="flex justify-between bg-black/20 p-2 rounded-lg">
                                    <span className="text-gray-400 font-sans">العدد المطلوب:</span>
                                    <span className="font-bold text-cyan-400">{prod.qtyRequested}</span>
                                  </div>
                                  <div className="flex justify-between bg-black/20 p-2 rounded-lg">
                                    <span className="text-gray-400 font-sans">العدد المبيوع:</span>
                                    <span className="font-bold text-emerald-400">{prod.qtySold}</span>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}

              {/* SUB B: MOBILE EXPENSES */}
              {moreSubTab === "expenses" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-200">فواتير المصاريف المسجلة</span>
                    <button
                      onClick={() => setIsAddExpenseOpen(true)}
                      className="text-[10px] bg-rose-500 hover:bg-rose-600 text-white px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      إضافة مصروف
                    </button>
                  </div>

                  <div className="space-y-3">
                    {[...expenses]
                      .sort((a, b) => parseDateToTime(b.date) - parseDateToTime(a.date))
                      .map((exp, idx) => (
                      <div key={idx} className="p-3 bg-[#111930]/40 border border-white/5 rounded-xl flex justify-between items-center text-right font-sans">
                        <div>
                          <span className="text-xs font-bold text-white block">{exp.Taper}</span>
                          <span className="text-[10px] text-gray-500 block mt-0.5 uppercase font-mono">{exp.ID}</span>
                        </div>
                        <div className="text-left font-mono">
                          <span className="text-xs font-bold text-rose-400 block">{formatCurrency(exp.Prix)}</span>
                          <span className="text-[9px] text-gray-500 block">{formatDateDisplay(exp.date)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SUB C: MOBILE SETTINGS */}
              {moreSubTab === "settings" && (
                <div className="space-y-4 animate-fade-in text-right">
                  <div className="p-4 bg-white/5 border border-white/5 rounded-xl space-y-3 text-xs">
                    <span className="text-gray-300 block font-bold">لوحة تحكم الهاتف Youcan UI</span>
                    <p className="text-[11px] text-gray-500 leading-relaxed font-sans">
                      نسخة الهاتف محسنة ومعدة خصيصاً لموظفي التوصيل والشاحنين في الميدان لتعديل حالات الشحنات فورا بطرق سريعة.
                    </p>
                    
                    <div className="pt-3 border-t border-white/5 flex flex-col gap-2">
                      {onSync && (
                        <button
                          onClick={onSync}
                          disabled={isSyncing}
                          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <RefreshCcw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                          <span>{isSyncing ? "مزامنة البيانات..." : "مزامنة البيانات فوراً"}</span>
                        </button>
                      )}

                      {onLogout && (
                        <button
                          onClick={onLogout}
                          className="w-full py-2.5 px-4 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 font-bold rounded-lg border border-rose-500/10 transition-colors flex items-center justify-center gap-2"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>تسجيل الخروج من الحساب</span>
                        </button>
                      )}
                    </div>

                    <div className="pt-3 border-t border-white/5 leading-relaxed text-[10px] text-gray-400 font-mono">
                      <div>إصدار السيرفر: v2.1.1</div>
                      <div>بوابة الربط: 1sRl7IlEBVzu...</div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

      </div>

      {/* Absolute Blue Floating Action Buttons relative to container */}
      {activePage === "purchases" && onAddPurchase && (
        <button
          onClick={onAddPurchase}
          className="absolute bottom-20 left-4 w-12 h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full shadow-lg flex items-center justify-center transition-all z-40 active:scale-95 border border-blue-500/20 cursor-pointer"
          aria-label="Add Purchase"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {activePage === "payments" && onAddPayment && (
        <button
          onClick={onAddPayment}
          className="absolute bottom-20 left-4 w-12 h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full shadow-lg flex items-center justify-center transition-all z-40 active:scale-95 border border-blue-500/20 cursor-pointer"
          aria-label="Add Payment"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* --- FLOATING BOTTOM MENU NAV FOR DEVICES (env safe bounds) --- */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md h-16 bg-[#0a1020]/95 border-t border-white/5 flex items-center justify-around px-4 z-45 select-none pb-safe-bottom" style={{ boxSizing: "border-box" }}>
        <button
          onClick={() => setActivePage("home")}
          className={`flex flex-col items-center justify-center p-1.5 transition-all outline-none ${
            activePage === "home" ? "text-blue-400 scale-105" : "text-gray-500 hover:text-white"
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[9px] font-bold mt-1 font-sans">الرئيسية</span>
        </button>

        <button
          onClick={() => setActivePage("sales")}
          className={`flex flex-col items-center justify-center p-1.5 transition-all outline-none ${
            activePage === "sales" ? "text-blue-400 scale-105" : "text-gray-500 hover:text-white"
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[9px] font-bold mt-1 font-sans">المبيعات</span>
        </button>

        <button
          onClick={() => setActivePage("purchases")}
          className={`flex flex-col items-center justify-center p-1.5 transition-all outline-none ${
            activePage === "purchases" ? "text-blue-400 scale-105" : "text-gray-500 hover:text-white"
          }`}
        >
          <Package className="w-5 h-5" />
          <span className="text-[9px] font-bold mt-1 font-sans">المشتريات</span>
        </button>

        <button
          onClick={() => setActivePage("payments")}
          className={`flex flex-col items-center justify-center p-1.5 transition-all outline-none ${
            activePage === "payments" ? "text-blue-400 scale-105" : "text-gray-500 hover:text-white"
          }`}
        >
          <CreditCard className="w-5 h-5" />
          <span className="text-[9px] font-bold mt-1 font-sans">الدفعات</span>
        </button>

        <button
          onClick={() => setActivePage("more")}
          className={`flex flex-col items-center justify-center p-1.5 transition-all outline-none ${
            activePage === "more" ? "text-blue-400 scale-105" : "text-gray-500 hover:text-white"
          }`}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[9px] font-bold mt-1 font-sans">المزيد</span>
        </button>
      </div>

      {/* --- ADD EXPENSE BOTTOM SHEET DIALOG --- */}
      {isAddExpenseOpen && (
        <div className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-black/80 backdrop-blur-sm z-50 flex flex-col justify-end">
          <div className="bg-[#111930] border-t border-white/10 rounded-t-3xl p-6 text-right animate-slide-up max-h-[75%]" dir="rtl">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/5">
              <span className="text-white font-bold text-sm">تسجيل مصروفات الهاتف</span>
              <button onClick={() => setIsAddExpenseOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">نوع المصروفات (Taper)</label>
                <select
                  required
                  value={newExpenseForm.Taper}
                  onChange={e => setNewExpenseForm({ ...newExpenseForm, Taper: e.target.value })}
                  className="w-full bg-[#0d1426] border border-white/10 text-white rounded-xl px-3 py-2 text-xs"
                >
                  <option value="" disabled className="italic">اختر نوع المصروف...</option>
                  {finalExpenseTapers.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">القيمة الإجمالية (Prix DH)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={newExpenseForm.Prix === "" || newExpenseForm.Prix === undefined ? "" : newExpenseForm.Prix}
                  onChange={e => setNewExpenseForm({ ...newExpenseForm, Prix: e.target.value === "" ? "" : parseFloat(e.target.value) || 0 })}
                  className="w-full bg-[#0d1426] border border-white/10 text-white rounded-xl px-3 py-2 text-xs font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 font-bold text-white text-xs rounded-xl transition-colors"
              >
                تأكيد وتسجيل المصاريف بالملف
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- FILTER SLIDE UP SHEET DRAWER FOR SALES --- */}
      {isFilterSheetOpen && (
        <div className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-black/80 backdrop-blur-sm z-50 flex flex-col justify-end">
          <div className="bg-[#111930] border-t border-white/10 rounded-t-[32px] p-6 text-right animate-slide-up" dir="rtl">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/5">
              <span className="text-white font-bold text-xs flex items-center gap-1">
                <Filter className="w-4 h-4 text-blue-500" />
                تصفية متطورة للمبيعات
              </span>
              <button onClick={() => setIsFilterSheetOpen(false)} className="p-1 text-gray-400 hover:text-white rounded-full bg-white/5">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] text-gray-400 mb-1">الإجراء (Condition)</label>
                <select
                  value={selectedCondition}
                  onChange={e => setSelectedCondition(e.target.value)}
                  className="w-full bg-[#0d1426] border border-white/10 text-white rounded-xl px-3 py-2 text-xs"
                >
                  <option value="">الكل</option>
                  {CONDITIONS.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 mb-1">حالة الاستلام (Delivery)</label>
                <select
                  value={selectedDelivery}
                  onChange={e => setSelectedDelivery(e.target.value)}
                  className="w-full bg-[#0d1426] border border-white/10 text-white rounded-xl px-3 py-2 text-xs"
                >
                  <option value="">الكل</option>
                  {DELIVERY_STATUSES.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setSelectedCondition("");
                    setSelectedDelivery("");
                    setIsFilterSheetOpen(false);
                  }}
                  className="flex-1 py-2 bg-white/5 border border-white/5 hover:bg-white/10 rounded-xl text-gray-400 text-xs transition-colors"
                >
                  تصفير فوري
                </button>
                <button
                  onClick={() => setIsFilterSheetOpen(false)}
                  className="flex-1 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  تطبيق التصفية
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD SALE BOTTOM SHEET DIALOG --- */}
      {isAddSaleOpen && (
        <div className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-black/85 backdrop-blur-sm z-50 flex flex-col justify-end">
          <div className="bg-[#111930] rounded-t-[32px] border-t border-white/10 p-5 text-right flex flex-col max-h-[85%] overflow-hidden" dir="rtl">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/5 shrink-0">
              <span className="text-white font-bold text-xs flex items-center gap-1">
                <Plus className="w-4 h-4 text-blue-500" />
                تحضير وإضافة طلب يوكان جديد
              </span>
              <button onClick={() => setIsAddSaleOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSale} className="flex-1 overflow-y-auto space-y-3.5 pr-1 py-1">
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">اسم العميل ورقم هاتفه</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="محمد المغربي"
                    value={newSaleForm["Full name"]}
                    onChange={e => setNewSaleForm({ ...newSaleForm, "Full name": e.target.value })}
                    className="bg-[#0d1426] border border-white/10 text-white rounded-xl px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    required
                    placeholder="0612345678"
                    maxLength={10}
                    value={newSaleForm.Phone}
                    onChange={e => setNewSaleForm({ ...newSaleForm, Phone: e.target.value })}
                    className="bg-[#0d1426] border border-white/10 text-white rounded-xl px-2.5 py-1.5 text-xs font-mono text-left"
                    dir="ltr"
                  />
                </div>
                {phoneError && <span className="text-red-400 block text-[9px] mt-1 pr-1">{phoneError}</span>}
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">المدينة والوجهة</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newSaleForm.City}
                    required
                    onChange={e => setNewSaleForm({ ...newSaleForm, City: e.target.value, Region: e.target.value })}
                    className="bg-[#0d1426] border border-white/10 text-white rounded-xl px-2.5 py-1.5 text-xs"
                  >
                    <option value="" disabled className="italic">اختر المدينة...</option>
                    {cityOptions.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="الجهة المستهدفة"
                    value={newSaleForm.Region}
                    onChange={e => setNewSaleForm({ ...newSaleForm, Region: e.target.value })}
                    className="bg-[#0d1426] border border-white/10 text-white rounded-xl px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-2">
                <span className="text-[10px] font-bold text-gray-400 block">فهرست السلعة المتوفرة</span>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[9px] text-gray-500 block mb-0.5">اختر المنتج بالكود</span>
                    <select
                      value={newSaleForm["Product name"]}
                      required
                      onChange={e => handleProductSelect(e.target.value)}
                      className="w-full bg-[#0d1426] border border-white/10 text-white rounded-lg px-2 py-1 text-xs"
                    >
                      <option value="" disabled className="italic">اختر المنتج...</option>
                      {productOptions.map(code => (
                        <option key={code} value={code}>{code}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span className="text-[9px] text-gray-500 block mb-0.5">سعر البيع المقترح</span>
                    <input
                      type="number"
                      required
                      value={newSaleForm["Variant price"] === "" || newSaleForm["Variant price"] === undefined ? "" : newSaleForm["Variant price"]}
                      onChange={e => setNewSaleForm({ ...newSaleForm, "Variant price": e.target.value === "" ? "" : parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#0d1426] border border-white/10 text-white rounded-lg px-2 py-1 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <span className="text-[9px] text-gray-500 block mb-0.5">الكمية المطلوبة</span>
                    <input
                      type="number"
                      min={1}
                      required
                      value={newSaleForm["Total quantity"] === "" || newSaleForm["Total quantity"] === undefined ? "" : newSaleForm["Total quantity"]}
                      onChange={e => setNewSaleForm({ ...newSaleForm, "Total quantity": e.target.value === "" ? "" : parseInt(e.target.value) || 1 })}
                      className="w-full bg-[#0d1426] border border-white/10 text-white rounded-lg px-2 py-1 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <span className="text-[9px] text-gray-500 block mb-0.5">المقاس / اللون (Variant)</span>
                    <input
                      type="text"
                      placeholder="مثال: XL / أحمر"
                      value={newSaleForm["Product variant"]}
                      onChange={e => setNewSaleForm({ ...newSaleForm, "Product variant": e.target.value })}
                      className="w-full bg-[#0d1426] border border-white/10 text-white rounded-lg px-2 py-1 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-400 mb-0.5">الحالة (Condition)</label>
                  <select
                    value={newSaleForm.Condition}
                    required
                    onChange={e => setNewSaleForm({ ...newSaleForm, Condition: e.target.value })}
                    className="w-full bg-[#0d1426] border border-white/10 text-white rounded-xl px-2.5 py-1.5 text-xs"
                  >
                    <option value="" disabled className="italic">اختر الإجراء...</option>
                    {CONDITIONS.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 mb-0.5">حالة التوصيل</label>
                  <select
                    value={newSaleForm.delivery}
                    onChange={e => setNewSaleForm({ ...newSaleForm, delivery: e.target.value })}
                    className="w-full bg-[#0d1426] border border-white/10 text-white rounded-xl px-2.5 py-1.5 text-xs"
                  >
                    <option value="">بانتظار التسليم</option>
                    {DELIVERY_STATUSES.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 mb-0.5 font-sans">الموزع (Livreur)</label>
                  <select
                    value={newSaleForm.Livreur}
                    required
                    onChange={e => setNewSaleForm({ ...newSaleForm, Livreur: e.target.value })}
                    className="w-full bg-[#0d1426] border border-white/10 text-white rounded-xl px-2.5 py-1.5 text-xs"
                  >
                    <option value="" disabled className="italic">اختر الموزع...</option>
                    {livreurOptions.map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors shrink-0"
              >
                تأكيد وتسجيل الطلبية بالصف
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- CELL PHONE ORDER DETAIL AUTO SAVE SHEET --- */}
      {selectedOrderDetail && (
        <div className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-black/90 backdrop-blur-sm z-50 flex flex-col justify-end">
          <div className="bg-[#111930] rounded-t-[32px] border-t border-white/10 p-5 text-right flex flex-col max-h-[85%] overflow-hidden" dir="rtl">
            <div className="flex justify-between items-center mb-3 shrink-0 pb-2 border-b border-white/5">
              <span className="text-white font-bold text-xs flex items-center gap-1.5">
                <Info className="w-4 h-4 text-blue-400" />
                تحرير وتعديل معطيات الطلب المباشرة
              </span>
              <button onClick={() => setSelectedOrderDetail(null)} className="p-1 rounded-full bg-white/5 text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 py-1 font-sans">
              <div className="p-3 bg-white/5 rounded-xl border border-white/5 font-mono space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400">رقم البوابة (Order ID):</span>
                  <span className="text-white font-bold uppercase">{selectedOrderDetail["Order ID"]}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400">اسم الزبون بالكامل:</span>
                  <span className="text-white font-sans">{selectedOrderDetail["Full name"]}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400">الهاتف:</span>
                  <span className="text-white">{selectedOrderDetail.Phone}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400">السلعة المستهدفة:</span>
                  <span className="text-blue-400 font-bold uppercase">{selectedOrderDetail["Product name"]}</span>
                </div>
              </div>

              {/* Instant Call actions */}
              <div className="flex gap-2 shrink-0 select-none">
                <a
                  href={`tel:${selectedOrderDetail.Phone}`}
                  className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <PhoneCall className="w-4 h-4" />
                  اتصال مباشر
                </a>
                <a
                  href={`${generateWhatsAppUrl(selectedOrderDetail.Phone || "")}?text=${encodeURIComponent(KHAYL_WHATSAPP_MESSAGE)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  شات واتساب
                </a>
              </div>

              {/* Editable selects which auto-saves on-the-fly! (Section 7.4) */}
              <div className="p-3 bg-[#0d1426] rounded-xl space-y-3">
                <span className="text-[10px] font-bold text-gray-400 block">منطقة التعديل الفوري الذكي (Auto-Save)</span>
                
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">الإجراء التشغيلي (Condition)</label>
                  <select
                    value={selectedOrderDetail.Condition || ""}
                    onChange={e => handleDetailUpdate(selectedOrderDetail._rowNum || 2, "Condition", e.target.value, selectedOrderDetail)}
                    className="w-full bg-[#111930] border border-white/5 text-white rounded-xl px-2.5 py-1.5 text-xs"
                  >
                    <option value="">Aucune</option>
                    {CONDITIONS.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">الموزع المكلف (Livreur)</label>
                  <select
                    value={selectedOrderDetail.Livreur || "CATHEDIS Express"}
                    onChange={e => handleDetailUpdate(selectedOrderDetail._rowNum || 2, "Livreur", e.target.value, selectedOrderDetail)}
                    className="w-full bg-[#111930] border border-white/5 text-white rounded-xl px-2.5 py-1.5 text-xs"
                  >
                    {LIVREURS.map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">حالة التسليم والارتجاع (Delivery)</label>
                  <select
                    value={selectedOrderDetail.delivery || ""}
                    onChange={e => handleDetailUpdate(selectedOrderDetail._rowNum || 2, "delivery", e.target.value, selectedOrderDetail)}
                    className="w-full bg-[#111930] border border-white/5 text-white rounded-xl px-2.5 py-1.5 text-xs text-blue-400"
                  >
                    <option value="">بانتظار التسليم</option>
                    {DELIVERY_STATUSES.map(d => (
                      <option key={d.value} value={d.value} className="text-white">{d.label}</option>
                    ))}
                  </select>
                </div>

                <div className="bg-emerald-500/10 text-emerald-400 text-[10px] p-2 rounded-lg text-center font-bold">
                  ✓ يتم تحديث قاعدة البيانات فوراً وتحديث KPIs تلقائياً
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

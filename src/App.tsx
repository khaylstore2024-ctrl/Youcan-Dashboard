import React, { useState, useEffect } from "react";
import { Order, Purchase, Payment, Expense, AppData } from "./types";
import { 
  fetchSheetData, 
  saveGenericRow, 
  updateOrderRow, 
  deleteGenericRow,
  formatCurrency, 
  validatePhone, 
  generateWhatsAppUrl,
  MOROCCAN_CITIES,
  CONDITIONS,
  LIVREURS,
  DELIVERY_STATUSES
} from "./data";
import { SalesTab } from "./components/SalesTab";
import { PurchasesTab } from "./components/PurchasesTab";
import { PaymentsTab } from "./components/PaymentsTab";
import { ExpensesTab } from "./components/ExpensesTab";
import { ReportsTab } from "./components/ReportsTab";
import { SettingsTab } from "./components/SettingsTab";
import { MobileView } from "./components/MobileView";
import { SaleAddModal, PurchaseAddModal, GenericModal } from "./components/Modals";
import { ConfirmationDialog } from "./components/ConfirmationDialog";
import { LoginPage } from "./components/LoginPage";

import { 
  ChevronLeft,
  ChevronRight,
  LayoutGrid, 
  ShoppingBag, 
  CreditCard, 
  Receipt, 
  BarChart3, 
  Settings as SettingsIcon, 
  Smartphone, 
  Monitor, 
  Sparkles, 
  Plus, 
  Calendar, 
  Check, 
  Info, 
  AlertTriangle, 
  ArrowUpRight, 
  TrendingUp, 
  RefreshCw,
  Truck,
  ClipboardCheck,
  FileQuestion,
  LogOut
} from "lucide-react";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem("is_app_authenticated") === "true";
  });

  // Device View Simulator mode: "desktop" or "mobile"
  const [deviceMode, setDeviceMode] = useState<"desktop" | "mobile">("desktop");
  
  // Active page selector for DESKTOP mode
  const [activeTab, setActiveTab] = useState<"sales" | "purchases" | "payments" | "expenses" | "reports" | "settings">("sales");

  // Sidebar collapsed state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  // Quick preset filter for SalesTab
  const [salesPreset, setSalesPreset] = useState<"all" | "delivery_requests" | "delivery_status" | "no_status">("all");

  // Database State
  const [data, setData] = useState<AppData>({
    sales: [],
    purchases: [],
    payments: [],
    expenses: []
  });

  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Modal control states
  const [isAddSaleOpen, setIsAddSaleOpen] = useState(false);
  const [isAddPurchaseOpen, setIsAddPurchaseOpen] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);

  // Edit / Details targeting states
  const [editingSale, setEditingSale] = useState<Order | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: "danger" | "warning" | "info";
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "warning",
    onConfirm: () => {}
  });

  // Trigger Toast Notification Alert
  const showToast = (text: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Sync Database from API proxy endpoints
  const syncDatabase = async () => {
    setIsLoading(true);
    try {
      // 1. Try to automated sync-pull from Google Sheets first to retrieve any external edits or new entries
      const token = sessionStorage.getItem("google_sheets_oauth_token");
      const pullHeaders: Record<string, string> = {};
      if (token) {
        pullHeaders["Authorization"] = `Bearer ${token}`;
      }
      
      let pulledSuccessfully = false;
      try {
        const pullRes = await fetch("/api/google-sheets/sync-pull", {
          method: "POST",
          headers: pullHeaders
        });
        const pullData = await pullRes.json();
        if (pullData.success) {
          console.log("Successfully auto-pulled live Google Sheets updates on load");
          pulledSuccessfully = true;
        }
      } catch (pullErr) {
        console.warn("Auto-pull live updates skipped or unconfigured:", pullErr);
      }

      // 2. Load the synchronized data from the local database
      const [salesRes, purchasesRes, paymentsRes, expensesRes] = await Promise.all([
        fetchSheetData("Youcan-Orders"),
        fetchSheetData("Achat"),
        fetchSheetData("Payments"),
        fetchSheetData("Expenses")
      ]);

      if (salesRes.success && purchasesRes.success && paymentsRes.success && expensesRes.success) {
        const cleanedSales = (salesRes.rows || []).map((sale: any) => {
          const rawL = sale.Livreur || "";
          const containsCathedis = rawL.toString().toUpperCase().includes("CATHEDIS");
          return {
            ...sale,
            Livreur: containsCathedis ? "CATHEDIS" : ""
          };
        });

        setData({
          sales: cleanedSales,
          purchases: purchasesRes.rows || [],
          payments: paymentsRes.rows || [],
          expenses: expensesRes.rows || []
        });
        
        if (pulledSuccessfully) {
          showToast("تم تحديث ومزامنة البيانات مع Google Sheets بنجاح!", "success");
        } else {
          showToast("تم تحميل البيانات من قاعدة البيانات المحلية بنجاح.", "info");
        }
      } else {
        showToast("حدث خطأ جزئى أثناء مزامنة البيانات من السيرفر.", "error");
      }
    } catch (err: any) {
      showToast(`فشل المزامنة: ${err.toString()}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    syncDatabase();
  }, []);

  // Dynamics dropdown choices compiled from actual sheet data columns (with defaults)
  const cityOptions = React.useMemo(() => {
    const list = Array.from(new Set(data.sales.map(s => s.City).filter(Boolean))) as string[];
    return list.length > 0 ? list : MOROCCAN_CITIES;
  }, [data.sales]);

  const livreurOptions = React.useMemo(() => {
    return LIVREURS;
  }, []);

  const productOptions = React.useMemo(() => {
    const list = Array.from(new Set([
      ...data.purchases.map(p => p.Code),
      ...data.sales.map(s => s["Product name"])
    ].filter(Boolean))) as string[];
    return list;
  }, [data.purchases, data.sales]);

  const supplierOptions = React.useMemo(() => {
    const list = Array.from(new Set([
      ...data.purchases.map(p => p.Fournisseur),
      ...data.payments.map(p => p.Fournisseur)
    ].filter(Boolean))) as string[];
    return list;
  }, [data.purchases, data.payments]);

  const productNamesOptions = React.useMemo(() => {
    const list = Array.from(new Set(data.purchases.map(p => p.Produit).filter(Boolean))) as string[];
    return list;
  }, [data.purchases]);

  const expenseTapersOptions = React.useMemo(() => {
    const list = Array.from(new Set(data.expenses.map(e => e.Taper).filter(Boolean))) as string[];
    return list.length > 0 ? list : ["Publicité Instagram", "Publicité Facebook", "Frais de livraison", "Frais généraux"];
  }, [data.expenses]);

  // CRUD Handler - Add/Edit Sale
  const handleSaveSale = async (values: any) => {
    await executeSaveSale(values);
  };

  const executeSaveSale = async (values: any) => {
    try {
      const isEdit = !!editingSale;
      const rowNum = editingSale ? editingSale._rowNum : undefined;
      
      const res = await saveGenericRow("Youcan-Orders", rowNum, values);
      if (res.success) {
        showToast(isEdit ? "تم تحديث بيانات الطلب بنجاح" : "تم حفظ الطلب الجديد في ملف المبيعات", "success");
        setEditingSale(null);
        setIsAddSaleOpen(false);
        await syncDatabase();
      } else {
        showToast(res.error || "فشل حفظ بيانات الطلبية", "error");
      }
    } catch (e: any) {
      showToast(e.toString(), "error");
    }
  };

  // CRUD Handler - Add/Edit Purchase
  const handleSavePurchase = async (values: any) => {
    try {
      const isEdit = !!editingPurchase;
      const rowNum = editingPurchase ? editingPurchase._rowNum : undefined;
      
      // Compute automatic code-based fields for ID ACH-XXXX
      const codeId = isEdit && editingPurchase ? editingPurchase.ID : `ACH-${String(data.purchases.length + 1001).padStart(4, "0")}`;
      const payload = {
        ...values,
        ID: codeId
      };

      const res = await saveGenericRow("Achat", rowNum, payload);
      if (res.success) {
        showToast(isEdit ? "تم تحديث بيانات شحنة الشراء" : "تم استيراد شحنة الشراء الجديدة وتسجيلها", "success");
        setEditingPurchase(null);
        setIsAddPurchaseOpen(false);
        await syncDatabase();
      } else {
        showToast(res.error || "فشل حفظ البيانات", "error");
      }
    } catch (e: any) {
      showToast(e.toString(), "error");
    }
  };

  // CRUD Handler - Add/Edit Payment
  const handleSavePayment = async (values: any) => {
    try {
      const isEdit = !!editingPayment;
      const rowNum = editingPayment ? editingPayment._rowNum : undefined;
      const payId = isEdit && editingPayment ? editingPayment.ID : `PAY-${String(data.payments.length + 1001).padStart(4, "0")}`;

      const payload = { ...values, ID: payId };

      const res = await saveGenericRow("Payments", rowNum, payload);
      if (res.success) {
        showToast("تم تحديث سجل الدفعات لمصلحة المورد بنجاح", "success");
        setEditingPayment(null);
        setIsAddPaymentOpen(false);
        await syncDatabase();
      } else {
        showToast(res.error || "فشل رصد وتخزين مستند السداد", "error");
      }
    } catch (e: any) {
      showToast(e.toString(), "error");
    }
  };

  // CRUD Handler - Add/Edit Expense
  const handleSaveExpense = async (values: any) => {
    await executeSaveExpense(values);
  };

  const executeSaveExpense = async (values: any) => {
    try {
      const isEdit = !!editingExpense;
      const rowNum = editingExpense ? editingExpense._rowNum : undefined;
      const expId = editingExpense ? editingExpense.ID : `EXP-${String(data.expenses.length + 1001).padStart(4, "0")}`;

      const payload = { ...values, ID: expId };

      const res = await saveGenericRow("Expenses", rowNum, payload);
      if (res.success) {
        showToast("تم تسجيل وتعديل بنود المصاريف بنجاح", "success");
        setEditingExpense(null);
        setIsAddExpenseOpen(false);
        await syncDatabase();
      } else {
        showToast(res.error || "فشل حفظ بند المصروف بالملف", "error");
      }
    } catch (e: any) {
      showToast(e.toString(), "error");
    }
  };

  const triggerDeleteConfirm = (sheetName: string, rowNum: number, itemLabel: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "تأكيد حذف العنصر نهائياً ⚠️",
      message: `تنبيه فحص نزاهة المدخلات: أنت على وشك حذف العنصر "${itemLabel}" نهائياً من قاعدة البيانات وجدول ملف الزبيناء والشركاء سحابياً! هذا الإجراء خطير جداً وغير قابل للتراجع. هل تود الاستمرار بالحذف؟`,
      type: "danger",
      onConfirm: async () => {
        setConfirmDialog(p => ({ ...p, isOpen: false }));
        try {
          setIsLoading(true);
          const res = await deleteGenericRow(sheetName, rowNum);
          if (res.success) {
            showToast("تم حذف العنصر بنجاح من الملف السحابي وحساب الفروقات الكلية", "success");
            setEditingSale(null);
            setEditingExpense(null);
            await syncDatabase();
          } else {
            showToast(res.error || "فشل حذف العنصر", "error");
          }
        } catch (err: any) {
          showToast(err.toString(), "error");
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  // Direct Inline Updates (for immediate status modifications without modal popup)
  const handleInlineStatusUpdate = async (rowNum: number, updates: any) => {
    try {
      const res = await updateOrderRow("Youcan-Orders", rowNum, updates);
      if (res.success) {
        // Optimistic local state update to preserve page positioning and table states
        setData(prev => {
          const freshSales = prev.sales.map(s => {
            if (s._rowNum === rowNum) {
              return { ...s, ...updates };
            }
            return s;
          });
          return { ...prev, sales: freshSales };
        });
        showToast("تم تحديث حالة الشحنة تلقائياً وحساب الفروقات المالية والمصاريف بسلاسة", "success");
      } else {
        showToast(res.error || "فشل لتحديث الحالات", "error");
      }
    } catch (err: any) {
      showToast(err.toString(), "error");
    }
  };

  // 1. Calculate General High Performance Metrics for Desktop HUD Dashboard
  const statsOverview = React.useMemo(() => {
    const totalSales = data.sales.length;
    
    // Delivered metrics count and sum
    const deliveredSalesList = data.sales.filter(s => s.delivery === "Delivered");
    const deliveredCount = deliveredSalesList.length;

    // Delivery rate success percentage
    const deliveryRate = totalSales > 0 ? (deliveredCount / totalSales) * 105 : 0; // scaled nicely or mathematically calculated
    const deliveryRateExact = totalSales > 0 ? (deliveredCount / totalSales) * 100 : 0;

    // Delivered Revenue Sum
    const totalRevenueSum = deliveredSalesList.reduce((acc, s) => acc + (s["Total price"] || 0), 0);

    // Delivered profit / benefit (Bénéfice)
    const netProfitSum = deliveredSalesList.reduce((acc, s) => acc + (s["Bénéfice"] || 0), 0);
    
    // Total expenses sum ('Prix' column)
    const totalExpenses = data.expenses.reduce((acc, e) => acc + (e.Prix || 0), 0);

    // Dynamic Net profit = Benefit - Expenses (Section 4.2)
    const trueNetProjectProfit = netProfitSum - totalExpenses;

    const tourDeliveryInRoute = data.sales.filter(s => s.Condition === "Confirmed" && !s.delivery).length;

    // Average Order Value (AOV) based on delivered orders
    const averageOrderValue = deliveredCount > 0 ? totalRevenueSum / deliveredCount : 0;

    return {
      totalSales,
      deliveredCount,
      deliveryRateExact,
      totalRevenueSum,
      trueNetProjectProfit,
      tourDeliveryInRoute,
      averageOrderValue
    };
  }, [data]);

  if (!isAuthenticated) {
    return (
      <LoginPage 
        onLogin={() => {
          localStorage.setItem("is_app_authenticated", "true");
          setIsAuthenticated(true);
        }} 
      />
    );
  }

  return (
    <div className="bg-[#070a13] text-[#f3f4f6] min-h-screen flex flex-col font-sans select-none overflow-x-hidden antialiased pb-12" dir="rtl">
      
      {/* 1. TOP SIMULATOR VIEW SWITCHER HUD (Fidelity constraint) */}
      <div className="bg-[#0a1020]/90 border-b border-white/5 px-6 py-2 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md select-none">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce"></div>
          <span className="font-mono text-xs text-gray-400 font-bold tracking-wider">YouCan Live Control HUD Panel</span>
        </div>

        {/* Action Toggle controls */}
        <div className="flex gap-1.5 p-1 bg-[#111930] rounded-xl border border-white/5">
          <button
            onClick={() => setDeviceMode("desktop")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              deviceMode === "desktop"
                ? "bg-blue-600 text-white font-bold"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>لوحة الحاسوب (Desktop App)</span>
          </button>

          <button
            onClick={() => setDeviceMode("mobile")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              deviceMode === "mobile"
                ? "bg-blue-600 text-white font-bold"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>لوحة الهاتف 📱 (Mobile UI)</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={syncDatabase} 
            disabled={isLoading}
            className="p-1 px-3 bg-white/5 rounded-lg text-[11px] hover:bg-white/10 text-gray-300 font-semibold flex items-center gap-1 border border-white/5 transition-colors font-sans cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
            <span>مزامنة فوري</span>
          </button>

          <button 
            onClick={() => {
              localStorage.removeItem("is_app_authenticated");
              setIsAuthenticated(false);
            }}
            className="p-1 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-[11px] font-semibold flex items-center gap-1 border border-rose-500/20 transition-colors font-sans cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>خروج</span>
          </button>
        </div>
      </div>

      {/* 2. DEVICE CHANNELLING VIEW */}
      {deviceMode === "mobile" ? (
        /* Render high fidelity responsive mobile view controller simulator */
        <div className="flex-1 flex justify-center items-center py-6">
          <MobileView 
            sales={data.sales}
            purchases={data.purchases}
            payments={data.payments}
            expenses={data.expenses}
            onAddSale={(newSale) => {
              // Trigger proxy add sales
              handleSaveSale(newSale);
            }}
            onUpdateOrder={(rowNum, updates) => {
              handleInlineStatusUpdate(rowNum, updates);
            }}
            onAddExpense={(newExp) => {
              handleSaveExpense(newExp);
            }}
          />
        </div>
      ) : (
        /* Render main desktop layout with left/right reverse-rtl bar */
        <div className="flex-1 flex flex-row h-[100%] overflow-hidden">
          
          {/* A. SIDEBAR COMPONENT (Section 5.3) */}
          <aside className={`${isSidebarCollapsed ? "w-20" : "w-64"} bg-[#0a1020]/80 border-l border-white/5 flex flex-col justify-between shrink-0 select-none transition-all duration-300 ease-in-out`}>
            
            {/* Top portion */}
            <div>
              <div className={`p-4 flex ${isSidebarCollapsed ? "flex-col gap-4 items-center" : "items-center justify-between"} border-b border-indigo-500/5 transition-all duration-300`}>
                <div className={`flex items-center gap-3 ${isSidebarCollapsed ? "flex-col justify-center" : ""}`}>
                  <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/30 shrink-0">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  {!isSidebarCollapsed && (
                    <div className="transition-opacity duration-300">
                      <h2 className="font-extrabold text-white text-sm font-sans tracking-wide truncate">يوكان داصبورد</h2>
                      <span className="text-[9px] text-gray-500 block font-bold font-mono tracking-tight truncate">Sales Control Hub</span>
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors flex items-center justify-center shrink-0"
                  title={isSidebarCollapsed ? "توسيع القائمة" : "طي القائمة"}
                >
                  {isSidebarCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>

              {/* Navigation Options */}
              <nav className={`p-4 space-y-2 ${isSidebarCollapsed ? "px-2 text-center" : "text-border"}`} dir="rtl">
                <button
                  onClick={() => {
                    setActiveTab("sales");
                    setSalesPreset("all");
                  }}
                  title="المبيعات (Youcan Orders)"
                  className={`w-full flex items-center ${isSidebarCollapsed ? "justify-center px-0" : "justify-start gap-3"} p-3 text-xs font-bold font-sans rounded-xl border transition-all ${
                    activeTab === "sales" && salesPreset === "all"
                      ? "bg-blue-600/10 text-blue-400 border-blue-500/15"
                      : "text-gray-400 border-transparent hover:bg-white/5"
                  }`}
                >
                  <LayoutGrid className="w-5 h-5 shrink-0" />
                  {!isSidebarCollapsed && <span className="truncate">المبيعات (Youcan Orders)</span>}
                </button>

                {/* Quick Preset Buttons (Filters) */}
                <div className="space-y-1 my-1.5 pr-2 border-r border-white/5">
                  {/* Button 1: طلبات التوصيل */}
                  <button
                    onClick={() => {
                      setActiveTab("sales");
                      setSalesPreset("delivery_requests");
                    }}
                    title="طلبات التوصيل"
                    className={`w-full flex items-center ${isSidebarCollapsed ? "justify-center px-0" : "justify-start gap-3"} py-2 px-2.5 text-[11px] font-bold font-sans rounded-lg border transition-all ${
                      activeTab === "sales" && salesPreset === "delivery_requests"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/25"
                        : "text-gray-400 border-transparent hover:bg-white/5"
                    }`}
                  >
                    <Truck className="w-4 h-4 shrink-0 text-amber-500" />
                    {!isSidebarCollapsed && <span className="truncate">طلبات التوصيل</span>}
                  </button>

                  {/* Button 2: حاله التسليم */}
                  <button
                    onClick={() => {
                      setActiveTab("sales");
                      setSalesPreset("delivery_status");
                    }}
                    title="حاله التسليم"
                    className={`w-full flex items-center ${isSidebarCollapsed ? "justify-center px-0" : "justify-start gap-3"} py-2 px-2.5 text-[11px] font-bold font-sans rounded-lg border transition-all ${
                      activeTab === "sales" && salesPreset === "delivery_status"
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/25"
                        : "text-gray-400 border-transparent hover:bg-white/5"
                    }`}
                  >
                    <ClipboardCheck className="w-4 h-4 shrink-0 text-blue-400" />
                    {!isSidebarCollapsed && <span className="truncate">حاله التسليم</span>}
                  </button>

                  {/* Button 3: بدون حاله */}
                  <button
                    onClick={() => {
                      setActiveTab("sales");
                      setSalesPreset("no_status");
                    }}
                    title="بدون حاله"
                    className={`w-full flex items-center ${isSidebarCollapsed ? "justify-center px-0" : "justify-start gap-3"} py-2 px-2.5 text-[11px] font-bold font-sans rounded-lg border transition-all ${
                      activeTab === "sales" && salesPreset === "no_status"
                        ? "bg-purple-500/10 text-purple-400 border-purple-500/25"
                        : "text-gray-400 border-transparent hover:bg-white/5"
                    }`}
                  >
                    <FileQuestion className="w-4 h-4 shrink-0 text-purple-400" />
                    {!isSidebarCollapsed && <span className="truncate">بدون حاله</span>}
                  </button>
                </div>

                <button
                  onClick={() => setActiveTab("purchases")}
                  title="المشتريات وإدارة السلع (Achat)"
                  className={`w-full flex items-center ${isSidebarCollapsed ? "justify-center px-0" : "justify-start gap-3"} p-3 text-xs font-bold font-sans rounded-xl border transition-all ${
                    activeTab === "purchases"
                      ? "bg-blue-600/10 text-blue-400 border-blue-500/15"
                      : "text-gray-400 border-transparent hover:bg-white/5"
                  }`}
                >
                  <ShoppingBag className="w-5 h-5 shrink-0" />
                  {!isSidebarCollapsed && <span className="truncate">المشتريات وإدارة السلع (Achat)</span>}
                </button>

                <button
                  onClick={() => setActiveTab("payments")}
                  title="الدفعات وتصفية الموردين"
                  className={`w-full flex items-center ${isSidebarCollapsed ? "justify-center px-0" : "justify-start gap-3"} p-3 text-xs font-bold font-sans rounded-xl border transition-all ${
                    activeTab === "payments"
                      ? "bg-blue-600/10 text-blue-400 border-blue-500/15"
                      : "text-gray-400 border-transparent hover:bg-white/5"
                  }`}
                >
                  <CreditCard className="w-5 h-5 shrink-0" />
                  {!isSidebarCollapsed && <span className="truncate">الدفعات وتصفية الموردين</span>}
                </button>

                <button
                  onClick={() => setActiveTab("expenses")}
                  title="المصاريف والربحية (Expenses)"
                  className={`w-full flex items-center ${isSidebarCollapsed ? "justify-center px-0" : "justify-start gap-3"} p-3 text-xs font-bold font-sans rounded-xl border transition-all ${
                    activeTab === "expenses"
                      ? "bg-blue-600/10 text-blue-400 border-blue-500/15"
                      : "text-gray-400 border-transparent hover:bg-white/5"
                  }`}
                >
                  <Receipt className="w-5 h-5 shrink-0" />
                  {!isSidebarCollapsed && <span className="truncate">المصاريف والربحية (Expenses)</span>}
                </button>

                <button
                  onClick={() => setActiveTab("reports")}
                  title="التقارير التفصيلية المتقدمة"
                  className={`w-full flex items-center ${isSidebarCollapsed ? "justify-center px-0" : "justify-start gap-3"} p-3 text-xs font-bold font-sans rounded-xl border transition-all ${
                    activeTab === "reports"
                      ? "bg-blue-600/10 text-blue-400 border-blue-500/15"
                      : "text-gray-400 border-transparent hover:bg-white/5"
                  }`}
                >
                  <BarChart3 className="w-5 h-5 shrink-0" />
                  {!isSidebarCollapsed && <span className="truncate">التقارير التفصيلية المتقدمة</span>}
                </button>

                <button
                  onClick={() => setActiveTab("settings")}
                  title="إعدادات النظام والتهيئة"
                  className={`w-full flex items-center ${isSidebarCollapsed ? "justify-center px-0" : "justify-start gap-3"} p-3 text-xs font-bold font-sans rounded-xl border transition-all ${
                    activeTab === "settings"
                      ? "bg-blue-600/10 text-blue-400 border-blue-500/15"
                      : "text-gray-400 border-transparent hover:bg-white/5"
                  }`}
                >
                  <SettingsIcon className="w-5 h-5 shrink-0" />
                  {!isSidebarCollapsed && <span className="truncate">إعدادات النظام والتهيئة</span>}
                </button>
              </nav>
            </div>

            {/* Bottom active connection check (Section 5.3) */}
            <div className={`p-4 border-t border-white/5 bg-[#070a13]/10 flex ${isSidebarCollapsed ? "justify-center" : "items-center gap-3"}`}>
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-glow shadow-green-500 shrink-0"></div>
              {!isSidebarCollapsed && (
                <span className="text-xs text-slate-400 font-mono font-medium truncate select-none">v2.1.1 — Connected</span>
              )}
            </div>
          </aside>

          {/* B. MAIN INTERACTIVE CONTENT AREA */}
          <main className="flex-1 flex flex-col px-8 py-6 select-none max-w-full overflow-hidden">
            
            {/* Header Title dashboard */}
            <div className="flex items-center justify-between mb-8 select-none">
              <div>
                <span className="text-xs text-gray-500 block font-semibold mb-0.5 uppercase">لوحة البيانات الكلية</span>
                <h1 className="text-2xl font-black text-white font-sans flex items-center gap-2">
                  {activeTab === "sales" && "رصد وتعديل المبيعات اليومية"}
                  {activeTab === "purchases" && "السلع المستوردة وحسابات الموردين"}
                  {activeTab === "payments" && "سجل الدفعات المستحقة والمصروفة"}
                  {activeTab === "expenses" && "إدارة أعباء المشروع والمصاريف"}
                  {activeTab === "reports" && "التقارير التحليلية والمؤشرات"}
                  {activeTab === "settings" && "تكامل خلايا العمل والربط"}
                </h1>
              </div>

              {/* High level visual date indicator */}
              <div className="flex gap-4 items-center">
                <div className="bg-white/5 border border-white/5 p-2 px-4 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span className="font-mono text-gray-300">2026-05-31</span>
                </div>
              </div>
            </div>

            {/* C. 5 KPI STATS GRID VIEW */}
            {activeTab === "sales" && (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-6 mb-8" id="sales-kpi-row">
                {/* HUD Card 1: Total volume transactions */}
                <div className="bg-[#111930]/60 border border-white/5 p-5 rounded-2xl relative overflow-hidden glass-effect">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500"></div>
                  <div className="text-gray-400 text-xs font-semibold mb-1">إجمالي المبيعات بالملف</div>
                  <div className="text-2xl font-black font-mono tracking-tight text-white">{statsOverview.totalSales} طلبات</div>
                  <div className="mt-2 text-[10px] text-gray-500">شامل المعلقة والملغاة والمرتقب شحنها</div>
                </div>

                {/* HUD Card 2: Absolute net Profit calculation strictly according to Section 4.2 */}
                <div className="bg-[#111930]/60 border border-white/5 p-5 rounded-2xl relative overflow-hidden glass-effect">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-green-500"></div>
                  <div className="text-gray-400 text-xs font-semibold mb-1">صافي الأرباح العـام</div>
                  <div className={`text-2xl font-black font-mono tracking-tight ${statsOverview.trueNetProjectProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatCurrency(statsOverview.trueNetProjectProfit)}
                  </div>
                  <div className="mt-2 text-[10px] text-gray-500">مخصوم منها المصاريف المسجلة</div>
                </div>

                {/* HUD Card 3: Delivered orders volume */}
                <div className="bg-[#111930]/60 border border-white/5 p-5 rounded-2xl relative overflow-hidden glass-effect">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500"></div>
                  <div className="text-gray-400 text-xs font-semibold mb-1">طلبات قيد التوصيل والمشحونة</div>
                  <div className="text-2xl font-black font-mono tracking-tight text-amber-400">{statsOverview.tourDeliveryInRoute} طلبات</div>
                  <div className="mt-2 text-[10px] text-amber-500 font-bold">بانتظار معاودة الاتصال والشحن</div>
                </div>

                {/* HUD Card 4: Success percentage with visual progress strip */}
                <div className="bg-[#111930]/60 border border-white/5 p-5 rounded-2xl relative overflow-hidden glass-effect">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500"></div>
                  <div className="text-gray-400 text-xs font-semibold mb-1">نسبة التوصيل والاستلام الناجحة</div>
                  <div className="text-2xl font-black font-mono tracking-tight text-white">{statsOverview.deliveryRateExact.toFixed(1)}%</div>
                  
                  {/* Progress bar strip */}
                  <div className="mt-3 w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full rounded-full transition-all duration-1000" style={{ width: `${statsOverview.deliveryRateExact}%` }}></div>
                  </div>
                </div>

                {/* HUD Card 5: Average Order Value (AOV) strictly based on Delivered orders */}
                <div className="bg-[#111930]/60 border border-white/5 p-5 rounded-2xl relative overflow-hidden glass-effect">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500"></div>
                  <div className="text-gray-400 text-xs font-semibold mb-1">متوسط قيمة الطلب (AOV)</div>
                  <div className="text-2xl font-black font-mono tracking-tight text-rose-400">
                    {formatCurrency(statsOverview.averageOrderValue)}
                  </div>
                  <div className="mt-2 text-[10px] text-gray-500">بناءً على الطلبات المكتملة (Delivered)</div>
                </div>
              </div>
            )}

            {/* D. DYNAMIC TABS ROUTER ELEMENT */}
            <div className="flex-1 overflow-hidden min-h-[500px]">
              
              {activeTab === "sales" && (
                <SalesTab 
                  sales={data.sales}
                  purchases={data.purchases}
                  onAddSale={() => setIsAddSaleOpen(true)}
                  onEditSale={(sale) => setEditingSale(sale)}
                  onUpdateOrder={handleInlineStatusUpdate}
                  salesPreset={salesPreset}
                  setSalesPreset={setSalesPreset}
                />
              )}

              {activeTab === "purchases" && (
                <PurchasesTab 
                  purchases={data.purchases}
                  sales={data.sales}
                  payments={data.payments}
                  onAddPurchase={() => setIsAddPurchaseOpen(true)}
                  onEditPurchase={(pur) => setEditingPurchase(pur)}
                />
              )}

              {activeTab === "payments" && (
                <PaymentsTab 
                  payments={data.payments}
                  purchases={data.purchases}
                  onAddPayment={() => setIsAddPaymentOpen(true)}
                  onEditPayment={(pay) => setEditingPayment(pay)}
                />
              )}

              {activeTab === "expenses" && (
                <ExpensesTab 
                  expenses={data.expenses}
                  sales={data.sales}
                  onAddExpense={() => setIsAddExpenseOpen(true)}
                  onEditExpense={(exp) => setEditingExpense(exp)}
                />
              )}

              {activeTab === "reports" && (
                <ReportsTab 
                  sales={data.sales}
                  purchases={data.purchases}
                  expenses={data.expenses}
                />
              )}

              {activeTab === "settings" && (
                <SettingsTab 
                  onSync={syncDatabase}
                  isLoading={isLoading}
                />
              )}

            </div>

          </main>
        </div>
      )}

      {/* --- FLOATING TOAST POPUPS NOTIFICATION DISPATCHER --- */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl border shadow-2xl flex items-center gap-3 backdrop-blur-md toast-slide-in text-xs font-semibold font-sans min-w-[280px]" style={{
          backgroundColor: toastMessage.type === "success" ? "rgba(16, 185, 129, 0.15)" : toastMessage.type === "error" ? "rgba(239, 68, 68, 0.15)" : "rgba(59, 130, 246, 0.15)",
          borderColor: toastMessage.type === "success" ? "rgba(16, 185, 129, 0.3)" : toastMessage.type === "error" ? "rgba(239, 68, 68, 0.3)" : "rgba(59, 130, 246, 0.3)",
          color: toastMessage.type === "success" ? "#10b981" : toastMessage.type === "error" ? "#f87171" : "#60a5fa"
        }}>
          <div className="w-2 h-2 rounded-full block" style={{
            backgroundColor: toastMessage.type === "success" ? "#10b981" : toastMessage.type === "error" ? "#ef4444" : "#3b82f6"
          }}></div>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* --- ADD NEW SALE ROW DIALOG --- */}
      {isAddSaleOpen && (
        <SaleAddModal 
          onClose={() => setIsAddSaleOpen(false)}
          onSave={handleSaveSale}
          purchases={data.purchases}
          nextOrderId={`WSP-${String(data.sales.length + 1001).padStart(4, "0")}`}
          cityOptions={cityOptions}
          livreurOptions={livreurOptions}
          productOptions={productOptions}
        />
      )}

      {/* --- EDIT EXISTING SALE ROW DIALOG (Section 5.6) --- */}
      {editingSale && (
        <GenericModal 
          title="تحديث وتعديل تفاصيل الطلب"
          onClose={() => setEditingSale(null)}
          onSave={handleSaveSale}
          initialValues={editingSale}
          deleteBtn={{
            label: "حذف هذا الطلب نهائياً",
            onDelete: () => {
              triggerDeleteConfirm("Youcan-Orders", editingSale._rowNum!, editingSale["Order ID"] || "غير معروف");
            }
          }}
          fields={[
            { key: "Order ID", label: "رقم الطلب (معرف الطلب)", type: "text", disabled: true },
            { key: "Order date", label: "تاريخ الطلب", type: "date", required: true },
            { key: "Full name", label: "اسم العميل بالكامل", type: "text", required: true },
            { key: "Phone", label: "رقم الهاتف", type: "text", required: true },
            { key: "City", label: "المدينة", type: "select", options: cityOptions, required: true },
            { key: "Region", label: "الجهة / المقاطعة للتوصيل", type: "text" },
            { key: "Product name", label: "كود المنتج (Code)", type: "select", options: productOptions, required: true },
            { key: "Product URL", label: "رابط صفحة السلعة بالمتجر (Product URL)", type: "url" },
            { key: "Variant price", label: "سعر البيع المعتمد بالدرهم", type: "number", required: true },
            { key: "Total quantity", label: "الكمية المطلوبة (Quantity)", type: "number", required: true },
            { key: "Condition", label: "إجراء التثبيت (Condition)", type: "select", options: CONDITIONS.map(c => c.value), required: true },
            { key: "Livreur", label: "موزع الشحن المكلف", type: "select", options: livreurOptions, required: true },
            { key: "delivery", label: "حالة الاستلام (Delivery Case-Sensitive)", type: "select", options: DELIVERY_STATUSES.map(d => d.value) }
          ]}
        />
      )}

      {/* --- ADD NEW PURCHASE WINDOW --- */}
      {isAddPurchaseOpen && (
        <PurchaseAddModal 
          onClose={() => setIsAddPurchaseOpen(false)}
          onSave={handleSavePurchase}
          purchases={data.purchases}
          supplierOptions={supplierOptions}
          productNamesOptions={productNamesOptions}
        />
      )}

      {/* --- EDIT EXISTING PURCHASE WINDOW --- */}
      {editingPurchase && (
        <GenericModal 
          title="تعديل شحنة الشراء في المستودع"
          onClose={() => setEditingPurchase(null)}
          onSave={handleSavePurchase}
          initialValues={editingPurchase}
          fields={[
            { key: "ID", label: "رمز الشحنة (تلقائي لا يعدل)", type: "text", disabled: true },
            { key: "date", label: "تاريخ الشراء والاستلام في المستودع", type: "date", required: true },
            { key: "Produit", label: "اسم المنتج", type: "select", options: productNamesOptions, required: true },
            { key: "Code", label: "كود رمز المنتج الموحد (Code)", type: "text", required: true },
            { key: "nombre", label: "كمية القطع الموردة (Nombre)", type: "number", required: true },
            { key: "Prix Unit", label: "سعر شراء القطعة من الموزع الأساسي", type: "number", required: true },
            { key: "Prix de vente", label: "سعر بيع القطعة المفترض للعميل", type: "number", required: true },
            { key: "Fournisseur", label: "اسم المورد المسؤول", type: "select", options: supplierOptions, required: true }
          ]}
        />
      )}

      {/* --- REGISTER NEW SUPPLIER PAYMENT DISBURSED --- */}
      {isAddPaymentOpen && (
        <GenericModal 
          title="تسجيل حوالة دفع جديدة لمورد"
          onClose={() => setIsAddPaymentOpen(false)}
          onSave={handleSavePayment}
          fields={[
            { key: "date", label: "تاريخ السداد", type: "date", required: true },
            { key: "Fournisseur", label: "اسم المورّد المستلم", type: "select", options: supplierOptions, required: true },
            { key: "Payment", label: "قيمة الحوالة المدفوعة بالدرهم (Payment)", type: "number", required: true }
          ]}
        />
      )}

      {/* --- EDIT REGISTERED SUPPLIER PAYMENT DISBURSED --- */}
      {editingPayment && (
        <GenericModal 
          title="تحديث مستند الحوالة المالية"
          onClose={() => setEditingPayment(null)}
          onSave={handleSavePayment}
          initialValues={editingPayment}
          fields={[
            { key: "ID", label: "رقم الحوالة الورقية (مؤشر ID)", type: "text", disabled: true },
            { key: "date", label: "تاريخ الدفع الفعلي", type: "date", required: true },
            { key: "Fournisseur", label: "المورد المستحق", type: "select", options: supplierOptions, required: true },
            { key: "Payment", label: "القيمة المدفوعة (Payment)", type: "number", required: true }
          ]}
        />
      )}

      {/* --- ADD NEW EXPENSE WINDOW --- */}
      {isAddExpenseOpen && (
        <GenericModal 
          title="تسجيل وإدخل بند مصاريف"
          onClose={() => setIsAddExpenseOpen(false)}
          onSave={handleSaveExpense}
          fields={[
            { key: "date", label: "تاريخ حدوث التكاليف", type: "date", required: true },
            { key: "Prix", label: "القيمة الإجمالية المنفقة بالدرهم (Prix)", type: "number", required: true },
            { key: "Taper", label: "اسم النوع / نوع المصروف ومكانه", type: "select", options: expenseTapersOptions, required: true }
          ]}
        />
      )}

      {/* --- EDIT REGISTERED EXPENSE --- */}
      {editingExpense && (
        <GenericModal 
          title="تحديث مستند المصروفات"
          onClose={() => setEditingExpense(null)}
          onSave={handleSaveExpense}
          initialValues={editingExpense}
          deleteBtn={{
            label: "حذف هذا المصروف نهائياً",
            onDelete: () => {
              triggerDeleteConfirm("Expenses", editingExpense._rowNum!, editingExpense.ID || "غير معروف");
            }
          }}
          fields={[
            { key: "ID", label: "رقم قيد المصروف (ID)", type: "text", disabled: true },
            { key: "date", label: "تاريخ المصروف", type: "date", required: true },
            { key: "Prix", label: "القيمة المنفقة (Prix)", type: "number", required: true },
            { key: "Taper", label: "شرح المصروف (Taper)", type: "select", options: expenseTapersOptions, required: true }
          ]}
        />
      )}

      {/* Global Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(p => ({ ...p, isOpen: false }))}
        type={confirmDialog.type}
      />

    </div>
  );
}

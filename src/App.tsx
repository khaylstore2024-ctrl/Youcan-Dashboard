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
import { NoPurchaseTab } from "./components/NoPurchaseTab";
import { MobileView } from "./components/MobileView";
import { SaleAddModal, PurchaseAddModal, GenericModal } from "./components/Modals";
import { ConfirmationDialog } from "./components/ConfirmationDialog";
import { LoginPage } from "./components/LoginPage";
import { ProductImageMapperModal } from "./components/ProductImageMapperModal";

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
  PackageCheck,
  UserX,
  LogOut
} from "lucide-react";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem("is_app_authenticated") === "true";
  });

  // Global Font State
  const [currentFont, setCurrentFont] = useState<string>(() => {
    return localStorage.getItem("app_global_font") || "Cairo";
  });

  const handleFontChange = (font: string) => {
    setCurrentFont(font);
    localStorage.setItem("app_global_font", font);
  };

  // Device View Simulator mode: "desktop" or "mobile"
  const [deviceMode, setDeviceMode] = useState<"desktop" | "mobile">("desktop");
  
  // Active page selector for DESKTOP mode
  const [activeTab, setActiveTab] = useState<"sales" | "purchases" | "payments" | "expenses" | "reports" | "settings" | "no_purchase">("sales");

  // Sidebar collapsed state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  // Quick preset filter for SalesTab
  const [salesPreset, setSalesPreset] = useState<"all" | "delivery_requests" | "delivery_status" | "no_status" | "delivered_parcels">("all");
  const [salesResetTrigger, setSalesResetTrigger] = useState(0);

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
  const [isProductMapperOpen, setIsProductMapperOpen] = useState(false);

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

  // Sync Database instantly from the local speed-indexed JSON cache endpoint, and query Google Sheets quietly in the background.
  const loadLocalData = async (showSpinner = false) => {
    if (showSpinner) setIsLoading(true);
    try {
      const res = await fetch("/api/get-all-sheets");
      const result = await res.json();
      if (result.success) {
        const cleanedSales = (result.sales || []).map((sale: any) => {
          const rawL = sale.Livreur || "";
          const containsCathedis = rawL.toString().toUpperCase().includes("CATHEDIS");
          return {
            ...sale,
            Livreur: containsCathedis ? "CATHEDIS" : rawL
          };
        });

        setData({
          sales: cleanedSales,
          purchases: result.purchases || [],
          payments: result.payments || [],
          expenses: result.expenses || []
        });
        return true;
      } else {
        showToast(result.error || "حدث خطأ أثناء تحميل البيانات المحلية.", "error");
        return false;
      }
    } catch (err: any) {
      showToast(`فشل قراءة الملف المحلي: ${err.toString()}`, "error");
      return false;
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  };

  const syncGoogleSheetsInBackground = async (force = false) => {
    try {
      const token = sessionStorage.getItem("google_sheets_oauth_token");
      const pullHeaders: Record<string, string> = {
        "Content-Type": "application/json"
      };
      if (token) {
        pullHeaders["Authorization"] = `Bearer ${token}`;
      }

      const pullRes = await fetch("/api/google-sheets/sync-pull", {
        method: "POST",
        headers: pullHeaders,
        body: JSON.stringify({ force })
      });
      const pullData = await pullRes.json();
      if (pullData.success && !pullData.skipped) {
        console.log("Silent remote Google Sheets pull completed.");
        // Quietly load the newly synchronized data into state without user-visible loader interruption
        await loadLocalData(false);
        showToast("مزامنة الخلفية: تم جلب التحديثات السحابية بنجاح 🟢", "success");
      }
    } catch (err) {
      console.warn("Background sheet auto-pull skipped or unconfigured:", err);
    }
  };

  const syncDatabase = async (force = false) => {
    // 1. Rapidly charge database arrays from local server-side JSON (extremely fast, ~20ms)
    const localLoaded = await loadLocalData(true);
    if (localLoaded) {
      // 2. Schedule the heavy sheets sync as a non-blocking background task
      syncGoogleSheetsInBackground(force);
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
    const list = Array.from(new Set([
      ...LIVREURS,
      ...data.sales.map(s => s.Livreur).filter(Boolean)
    ])) as string[];
    return list;
  }, [data.sales]);

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
        await loadLocalData(false);
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
        await loadLocalData(false);
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
        await loadLocalData(false);
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
        await loadLocalData(false);
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
            await loadLocalData(false);
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

  // Direct Inline Updates (fully optimistic, responsive background tracking)
  const handleInlineStatusUpdate = async (rowNum: number, updates: any) => {
    // 1. Keep track of current states in case we need to roll back
    let previousSaleState: any = null;
    
    // 2. Perform INSTANT optimistic local state update for zero-lag UI response
    setData(prev => {
      const freshSales = prev.sales.map(s => {
        if (s._rowNum === rowNum) {
          previousSaleState = { ...s };
          return { ...s, ...updates };
        }
        return s;
      });
      return { ...prev, sales: freshSales };
    });

    // 3. Trigger remote update completely in the background
    try {
      const res = await updateOrderRow("Youcan-Orders", rowNum, updates);
      if (!res.success) {
        // Rollback state instantly
        if (previousSaleState) {
          setData(prev => {
            const rolledBackSales = prev.sales.map(s => s._rowNum === rowNum ? previousSaleState : s);
            return { ...prev, sales: rolledBackSales };
          });
        }
        showToast(res.error || "فشل حفظ التحديث في الخلفية", "error");
      }
    } catch (err: any) {
      // Rollback on exception
      if (previousSaleState) {
        setData(prev => {
          const rolledBackSales = prev.sales.map(s => s._rowNum === rowNum ? previousSaleState : s);
          return { ...prev, sales: rolledBackSales };
        });
      }
      showToast("خطأ اتصال: لم يتم الحفظ بالخلفية " + err.toString(), "error");
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

    // Sum of all sales "Total price"
    const totalSalesPriceSum = data.sales.reduce((acc, s) => acc + (s["Total price"] || 0), 0);

    // Sum of all sales "Bénéfice"
    const totalBeneficeSum = data.sales.reduce((acc, s) => acc + (s["Bénéfice"] || 0), 0);

    // Delivered profit / benefit (Bénéfice)
    const netProfitSum = deliveredSalesList.reduce((acc, s) => acc + (s["Bénéfice"] || 0), 0);
    
    // Total expenses sum ('Prix' column)
    const totalExpenses = data.expenses.reduce((acc, e) => acc + (e.Prix || 0), 0);

    // Dynamic Net profit = Benefit - Expenses (Section 4.2)
    const trueNetProjectProfit = netProfitSum - totalExpenses;

    const tourDeliveryInRoute = data.sales.filter(s => s.Condition === "Confirmed" && !s.delivery).length;

    // Average Order Value (AOV) based on delivered orders
    const averageOrderValue = deliveredCount > 0 ? totalRevenueSum / deliveredCount : 0;

    // Cost Per Sale = Total Expenses / Delivered Parcels Count
    const costPerSale = deliveredCount > 0 ? totalExpenses / deliveredCount : 0;

    return {
      totalSales,
      deliveredCount,
      deliveryRateExact,
      totalRevenueSum,
      totalSalesPriceSum,
      totalBeneficeSum,
      totalExpenses,
      trueNetProjectProfit,
      tourDeliveryInRoute,
      averageOrderValue,
      costPerSale
    };
  }, [data]);

  const pendingOrdersCount = React.useMemo(() => {
    return data.sales.filter(sale => {
      const cond = sale.Condition ? sale.Condition.trim() : "";
      return !cond || cond.toLowerCase() === "waiting for confirmation" || cond.toLowerCase() === "pending";
    }).length;
  }, [data.sales]);

  const noPurchaseCount = React.useMemo(() => {
    return data.sales.filter(sale => {
      const condition = sale.Condition ? sale.Condition.trim() : "";
      const delivery = sale.delivery ? sale.delivery.trim() : "";

      const isCancelledCondition = condition.toLowerCase() === "anule" || condition.toLowerCase() === "annulé";
      const isNoResponse = condition.toLowerCase() === "ne repond pas" || condition.toLowerCase() === "ne répond pas" || condition.toLowerCase() === "call again";
      const isReturnedDelivery = delivery.toLowerCase() === "retour" || delivery.toLowerCase() === "annuler" || delivery.toLowerCase() === "annulé sur place" || delivery.toLowerCase() === "annulé au téléphone";
      const isUnreachableDelivery = delivery.toLowerCase() === "client injoignable";

      return isCancelledCondition || isNoResponse || isReturnedDelivery || isUnreachableDelivery;
    }).length;
  }, [data.sales]);

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
    <div className="bg-[#070a13] text-[#f3f4f6] h-screen flex flex-col font-sans select-none overflow-hidden antialiased" dir="rtl">
      <style>{`
        * {
          font-family: '${currentFont}', 'Cairo', 'Tajawal', 'Inter', sans-serif !important;
        }
      `}</style>
      
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
          {/* Real-time local computer folder image product linking tool */}
          <button 
            onClick={() => setIsProductMapperOpen(true)}
            className="p-1 px-3 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border border-indigo-500/20 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>ربط وتعيين صور المنتجات 📷</span>
          </button>

          <button 
            onClick={() => syncDatabase(true)} 
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
        <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
          
          {/* A. SIDEBAR COMPONENT (Section 5.3) */}
          <aside className={`${isSidebarCollapsed ? "w-20" : "w-64"} bg-[#0a1020]/80 border-l border-white/5 flex flex-col justify-between shrink-0 select-none transition-all duration-300 ease-in-out h-full overflow-y-auto`}>
            
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
                  className={`w-full flex items-center ${isSidebarCollapsed ? "justify-center px-0" : "justify-start gap-3"} p-3 text-xs font-bold font-sans rounded-xl border transition-all relative ${
                    activeTab === "sales" && salesPreset === "all"
                      ? "bg-blue-600/10 text-blue-400 border-blue-500/15"
                      : "text-gray-400 border-transparent hover:bg-white/5"
                  }`}
                >
                  <LayoutGrid className="w-5 h-5 shrink-0" />
                  {!isSidebarCollapsed && <span className="truncate">المبيعات (Youcan Orders)</span>}
                  
                  {pendingOrdersCount > 0 && (
                    isSidebarCollapsed ? (
                      <span className="absolute top-2 left-2 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      </span>
                    ) : (
                      <span className="ms-auto bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold animate-pulse">
                        {pendingOrdersCount}
                      </span>
                    )
                  )}
                </button>

                {/* Quick Preset Buttons (Filters) */}
                <div className="space-y-1 my-1.5 pr-2 border-r border-white/5">
                  {/* Button 1: بدون تاكيد */}
                  <button
                    onClick={() => {
                      setActiveTab("sales");
                      setSalesPreset("no_status");
                      setSalesResetTrigger(prev => prev + 1);
                    }}
                    title="بدون تاكيد"
                    className={`w-full flex items-center ${isSidebarCollapsed ? "justify-center px-0" : "justify-start gap-3"} py-2 px-2.5 text-[11px] font-bold font-sans rounded-lg border transition-all ${
                      activeTab === "sales" && salesPreset === "no_status"
                        ? "bg-purple-500/10 text-purple-400 border-purple-500/25"
                        : "text-gray-400 border-transparent hover:bg-white/5"
                    }`}
                  >
                    <FileQuestion className="w-4 h-4 shrink-0 text-purple-400" />
                    {!isSidebarCollapsed && <span className="truncate">بدون تاكيد</span>}
                  </button>

                  {/* Button 2: طلبات الشحن */}
                  <button
                    onClick={() => {
                      setActiveTab("sales");
                      setSalesPreset("delivery_requests");
                      setSalesResetTrigger(prev => prev + 1);
                    }}
                    title="طلبات الشحن"
                    className={`w-full flex items-center ${isSidebarCollapsed ? "justify-center px-0" : "justify-start gap-3"} py-2 px-2.5 text-[11px] font-bold font-sans rounded-lg border transition-all ${
                      activeTab === "sales" && salesPreset === "delivery_requests"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/25"
                        : "text-gray-400 border-transparent hover:bg-white/5"
                    }`}
                  >
                    <Truck className="w-4 h-4 shrink-0 text-amber-500" />
                    {!isSidebarCollapsed && <span className="truncate">طلبات الشحن</span>}
                  </button>

                  {/* Button 3: حاله التسليم */}
                  <button
                    onClick={() => {
                      setActiveTab("sales");
                      setSalesPreset("delivery_status");
                      setSalesResetTrigger(prev => prev + 1);
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

                  {/* Button 4: الطرود المسلمة */}
                  <button
                    onClick={() => {
                      setActiveTab("sales");
                      setSalesPreset("delivered_parcels");
                      setSalesResetTrigger(prev => prev + 1);
                    }}
                    title="الطرود المسلمة"
                    className={`w-full flex items-center ${isSidebarCollapsed ? "justify-center px-0" : "justify-start gap-3"} py-2 px-2.5 text-[11px] font-bold font-sans rounded-lg border transition-all ${
                      activeTab === "sales" && salesPreset === "delivered_parcels"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                        : "text-gray-400 border-transparent hover:bg-white/5"
                    }`}
                  >
                    <PackageCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                    {!isSidebarCollapsed && <span className="truncate">الطرود المسلمة</span>}
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
                  onClick={() => setActiveTab("no_purchase")}
                  title="عملاء لم يشتروا (WhatsApp)"
                  className={`w-full flex items-center ${isSidebarCollapsed ? "justify-center px-0" : "justify-start gap-3"} p-3 text-xs font-bold font-sans rounded-xl border transition-all relative ${
                    activeTab === "no_purchase"
                      ? "bg-blue-600/10 text-blue-400 border-blue-500/15"
                      : "text-gray-400 border-transparent hover:bg-white/5"
                  }`}
                >
                  <UserX className="w-5 h-5 shrink-0" />
                  {!isSidebarCollapsed && <span className="truncate">عملاء لم يشتروا (WhatsApp)</span>}
                  
                  {noPurchaseCount > 0 && (
                    isSidebarCollapsed ? (
                      <span className="absolute top-2 left-2 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      </span>
                    ) : (
                      <span className="ms-auto bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold animate-pulse">
                        {noPurchaseCount}
                      </span>
                    )
                  )}
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
          <main className="flex-1 flex flex-col px-8 py-6 select-none max-w-full overflow-y-auto pb-16">
            
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
                  {activeTab === "no_purchase" && "متابعة وإعادة استهداف العملاء (لم يشتروا)"}
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

            {/* C. 6 KPI STATS GRID VIEW */}
            {activeTab === "sales" && (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-6 mb-8" id="sales-kpi-row">
                {/* Card 1: إجمالي الطلبات ونسبة التوصيل */}
                <div className="bg-[#111930]/60 border border-white/5 p-5 rounded-2xl relative overflow-hidden glass-effect">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500"></div>
                  <div className="text-gray-400 text-xs font-semibold mb-1">إجمالي الطلبات والتوصيل</div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-2xl font-black font-mono tracking-tight text-white" title="إجمالي طلبات الملف">
                      {statsOverview.totalSales} <span className="text-xs font-normal text-gray-400">طلب</span>
                    </span>
                    <span className="text-lg font-black font-mono text-indigo-400" title="نسبة التوصيل الناجح">
                      {statsOverview.deliveryRateExact.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-2 text-[10px] text-gray-400 flex justify-between items-center">
                    <span>
                      المسلّمة: <span className="text-emerald-400 font-bold">{statsOverview.deliveredCount}</span>
                    </span>
                    <span className="text-gray-500">جاهز للتسليم في الملف</span>
                  </div>
                  
                  {/* Progress bar strip */}
                  <div className="mt-3 w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full rounded-full transition-all duration-1000" style={{ width: `${statsOverview.deliveryRateExact}%` }}></div>
                  </div>
                </div>

                {/* Card 2: مجموع مبيعات الملف */}
                <div className="bg-[#111930]/60 border border-white/5 p-5 rounded-2xl relative overflow-hidden glass-effect">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500"></div>
                  <div className="text-gray-400 text-xs font-semibold mb-1">مجموع مبيعات الملف</div>
                  <div className="text-2xl font-black font-mono tracking-tight text-amber-400">
                    {formatCurrency(statsOverview.totalSalesPriceSum)}
                  </div>
                  <div className="mt-2 text-[10px] text-gray-500">مجموع قيم عمود Total price بالكامل</div>
                </div>

                {/* Card 3: مجموع أرباح الملف */}
                <div className="bg-[#111930]/60 border border-white/5 p-5 rounded-2xl relative overflow-hidden glass-effect">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-[#ec4899]"></div>
                  <div className="text-gray-400 text-xs font-semibold mb-1">مجموع أرباح الملف</div>
                  <div className="text-2xl font-black font-mono tracking-tight text-rose-400">
                    {formatCurrency(statsOverview.totalBeneficeSum)}
                  </div>
                  <div className="mt-2 text-[10px] text-gray-500">مجموع قيم عمود Bénéfice بالكامل</div>
                </div>

                {/* Card 4: صافي الأرباح العـام */}
                <div className="bg-[#111930]/60 border border-white/5 p-5 rounded-2xl relative overflow-hidden glass-effect">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-green-500"></div>
                  <div className="text-gray-400 text-xs font-semibold mb-1">صافي الأرباح العـام</div>
                  <div className={`text-2xl font-black font-mono tracking-tight ${statsOverview.trueNetProjectProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatCurrency(statsOverview.trueNetProjectProfit)}
                  </div>
                  <div className="mt-2 text-[10px] text-gray-500">مخصوم منها المصاريف المسجلة</div>
                </div>

                {/* Card 5: إجمالي المصاريف */}
                <div className="bg-[#111930]/60 border border-white/5 p-5 rounded-2xl relative overflow-hidden glass-effect">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-red-400"></div>
                  <div className="text-gray-400 text-xs font-semibold mb-1">إجمالي المصاريف</div>
                  <div className="text-2xl font-black font-mono tracking-tight text-red-400">
                    {formatCurrency(statsOverview.totalExpenses)}
                  </div>
                  <div className="mt-2 text-[10px] text-gray-500">مجموع قيم عمود Prix في المصاريف</div>
                </div>

                {/* Card 6: تكلفة المبيعة */}
                <div className="bg-[#111930]/60 border border-white/5 p-5 rounded-2xl relative overflow-hidden glass-effect">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-cyan-400"></div>
                  <div className="text-gray-400 text-xs font-semibold mb-1">تكلفة المبيعة</div>
                  <div className="text-2xl font-black font-mono tracking-tight text-cyan-400">
                    {formatCurrency(statsOverview.costPerSale)}
                  </div>
                  <div className="mt-2 text-[10px] text-gray-500">إجمالي المصاريف / الطرود المسلّمة</div>
                </div>
              </div>
            )}

            {/* D. DYNAMIC TABS ROUTER ELEMENT */}
            <div className="flex-1 min-h-[500px]">
              
              {activeTab === "sales" && (
                <SalesTab 
                  sales={data.sales}
                  purchases={data.purchases}
                  onAddSale={() => setIsAddSaleOpen(true)}
                  onEditSale={(sale) => setEditingSale(sale)}
                  onUpdateOrder={handleInlineStatusUpdate}
                  salesPreset={salesPreset}
                  setSalesPreset={setSalesPreset}
                  salesResetTrigger={salesResetTrigger}
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

              {activeTab === "no_purchase" && (
                <NoPurchaseTab 
                  sales={data.sales}
                  purchases={data.purchases}
                  onUpdateOrder={handleInlineStatusUpdate}
                />
              )}

              {activeTab === "settings" && (
                <SettingsTab 
                  onSync={syncDatabase}
                  isLoading={isLoading}
                  currentFont={currentFont}
                  onFontChange={handleFontChange}
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
            { key: "Product variant", label: "المقاس / اللون (Product variant)", type: "text" },
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

      {/* --- PRODUCT IMAGE MAPPING DYNAMIC MULTI-UPLOAD WINDOW --- */}
      {isProductMapperOpen && (
        <ProductImageMapperModal 
          sales={data.sales}
          purchases={data.purchases}
          onClose={() => setIsProductMapperOpen(false)}
          onSaved={() => {
            // Hot reload cached configs or states
            loadLocalData(false);
          }}
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

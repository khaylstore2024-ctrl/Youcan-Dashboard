import React, { useState } from "react";
import { Order, Purchase } from "../types";
import { MOROCCAN_CITIES, CONDITIONS, DELIVERY_STATUSES, LIVREURS, formatCurrency, formatDateDisplay, generateWhatsAppUrl } from "../data";
import { Search, Filter, Plus, Calendar, RotateCcw, Edit, Phone, MessageCircle, ExternalLink, ChevronRight, ChevronLeft, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { ConfirmationDialog } from "./ConfirmationDialog";

interface SalesTabProps {
  sales: Order[];
  purchases: Purchase[];
  onAddSale: () => void;
  onEditSale: (order: Order) => void;
  onUpdateOrder: (rowNum: number, updates: any) => void;
}

export const SalesTab: React.FC<SalesTabProps> = ({ sales, purchases, onAddSale, onEditSale, onUpdateOrder }) => {
  const distinctCities = React.useMemo(() => {
    return Array.from(new Set(sales.map(s => s.City).filter(Boolean))) as string[];
  }, [sales]);
  const cityOptions = distinctCities.length > 0 ? distinctCities : MOROCCAN_CITIES;

  const distinctLivreurs = React.useMemo(() => {
    return Array.from(new Set(sales.map(s => s.Livreur).filter(Boolean))) as string[];
  }, [sales]);
  const livreurOptions = distinctLivreurs.length > 0 ? distinctLivreurs : LIVREURS;

  // Confirm Dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCondition, setSelectedCondition] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedLivreur, setSelectedLivreur] = useState("");
  const [selectedDateRange, setSelectedDateRange] = useState("month"); // Default option is "month" as per requirement Section 9!
  const [isFilterOpen, setIsFilterOpen] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Custom filter check for date ranges
  const isDateInSelectedRange = (dateStr: string, range: string): boolean => {
    if (!dateStr) return false;
    const now = new Date();
    const cleanDateStr = dateStr.split(" ")[0]; // yyyy-mm-dd
    const orderDate = new Date(cleanDateStr);
    
    // Set time limits to start of days
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    
    const oneWeekAgo = new Date(todayStart);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    switch (range) {
      case "today":
        return orderDate >= todayStart;
      case "yesterday":
        return orderDate >= yesterdayStart && orderDate < todayStart;
      case "week":
        return orderDate >= oneWeekAgo;
      case "month":
        return orderDate >= startOfMonth;
      case "year":
        return orderDate >= startOfYear;
      case "all":
      default:
        return true;
    }
  };

  // Filter Sales
  const filteredSales = sales.filter(sale => {
    // Search Query (id, name, phone)
    const matchesSearch = !searchQuery ? true : (
      (sale["Order ID"] || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sale["Full name"] || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sale["Phone"] || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    const matchesCondition = !selectedCondition ? true : sale.Condition === selectedCondition;
    const matchesCity = !selectedCity ? true : sale.City === selectedCity;
    const matchesLivreur = !selectedLivreur ? true : sale.Livreur === selectedLivreur;
    const matchesDate = isDateInSelectedRange(sale["Order date"], selectedDateRange);

    return matchesSearch && matchesCondition && matchesCity && matchesLivreur && matchesDate;
  });

  // Sorting State
  const [sortField, setSortField] = useState<string>("Order date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Multi-direction sort (from smallest to largest and vice versa)
  const sortedSales = React.useMemo(() => {
    const items = [...filteredSales];
    if (!sortField) return items;

    items.sort((a, b) => {
      let valA = a[sortField as keyof Order];
      let valB = b[sortField as keyof Order];

      if (valA === undefined || valA === null) valA = "";
      if (valB === undefined || valB === null) valB = "";

      // Order date sorting logic (The latest date should be default)
      if (sortField === "Order date") {
        const dateA = new Date(String(valA).split(" ")[0]).getTime() || 0;
        const dateB = new Date(String(valB).split(" ")[0]).getTime() || 0;
        return sortDirection === "asc" ? dateA - dateB : dateB - dateA;
      }

      // Numeric sorting (Prix / totals)
      if (typeof valA === "number" && typeof valB === "number") {
        return sortDirection === "asc" ? valA - valB : valB - valA;
      }

      // Alphabetical sorting
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortDirection === "asc" ? strA.localeCompare(strB, "ar") : strB.localeCompare(strA, "ar");
    });

    return items;
  }, [filteredSales, sortField, sortDirection]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
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

  // Calculate current page slice
  const totalPages = Math.ceil(sortedSales.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentSales = sortedSales.slice(startIndex, startIndex + itemsPerPage);

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedCondition("");
    setSelectedCity("");
    setSelectedLivreur("");
    setSelectedDateRange("all");
    setCurrentPage(1);
  };

  // Handle rapid inline update with statistics auto-recalculation (Section 4.1 sync)
  const handleInlineChange = (rowNum: number, field: string, value: any, currentSale: Order) => {
    let fieldTitleAr = "الحل العام";
    if (field === "Condition") fieldTitleAr = "نوع الإجراء الإداري التثبيتي (Condition)";
    if (field === "Livreur") fieldTitleAr = "الموزع وشريك الشحن والتوصيل المكلف (Livreur)";
    if (field === "delivery") fieldTitleAr = "حالة إتمام واستلام الشحنة الفعلي (Delivery)";

    const oldValue = currentSale[field as keyof Order] || "غير محدد";
    
    // Custom label lookups for dropdown values
    let oldValueLabel = oldValue;
    let newValueLabel = value;

    if (field === "Condition") {
      oldValueLabel = CONDITIONS.find(c => c.value === oldValue)?.label || oldValue;
      newValueLabel = CONDITIONS.find(c => c.value === value)?.label || value;
    } else if (field === "delivery") {
      oldValueLabel = DELIVERY_STATUSES.find(d => d.value === oldValue)?.label || "بانتظار الشحن";
      newValueLabel = DELIVERY_STATUSES.find(d => d.value === value)?.label || "بانتظار الشحن";
    }

    setConfirmDialog({
      isOpen: true,
      title: "تأكيد تعديل معلومات الطلبية ⚠️",
      message: `تنبيه فحص نزاهة المدخلات: هل تريد تغيير حقل "${fieldTitleAr}" للطلب ذي الرقم "${currentSale["Order ID"]}" من [ ${oldValueLabel} ] إلى [ ${newValueLabel} ]؟ قد يؤثر ذلك على الحسابات المالية وصافي الأرباح العام.`,
      onConfirm: () => {
        setConfirmDialog(p => ({ ...p, isOpen: false }));
        executeInlineChange(rowNum, field, value, currentSale);
      }
    });
  };

  const executeInlineChange = (rowNum: number, field: string, value: any, currentSale: Order) => {
    const freshSale = { ...currentSale, [field]: value };
    
    // Find unit buying price (Achat lookup)
    const purchase = purchases.find(p => p.Code && p.Code.toUpperCase() === (freshSale["Product name"] || "").toUpperCase());
    const unitCost = purchase ? purchase["Prix Unit"] : 0;
    const supplierName = purchase ? purchase["Fournisseur"] : "";

    let totalPrice = 0;
    let finalUnitPrice = unitCost;
    let deliveryFee = 0;
    let profit = 0;
    let supplierPrice = 0;
    let finalSupplier = "";

    const activeDelivery = freshSale.delivery;

    if (activeDelivery === "Delivered") {
      totalPrice = (freshSale["Variant price"] || 0) * (freshSale["Total quantity"] || 1);
      finalUnitPrice = unitCost;
      deliveryFee = 40;
      supplierPrice = unitCost * (freshSale["Total quantity"] || 1);
      profit = totalPrice - supplierPrice - deliveryFee;
      finalSupplier = supplierName;
    } else if (["Retour", "annuler", "Client Injoignable", "Annulé Au Téléphone", "Annulé Sur Place"].includes(activeDelivery)) {
      totalPrice = 0;
      finalUnitPrice = 0;
      deliveryFee = 0;
      profit = 0;
      supplierPrice = 0;
      finalSupplier = "";
    } else {
      // Pending
      totalPrice = 0;
      finalUnitPrice = 0;
      deliveryFee = 0;
      profit = 0;
      supplierPrice = 0;
      finalSupplier = "";
    }

    const updates = {
      [field]: value,
      "Total price": totalPrice,
      "prix d'achat": finalUnitPrice,
      "Frais livraison": deliveryFee,
      "Bénéfice": profit,
      "Fournisseur": finalSupplier,
      "Fourni price": supplierPrice
    };

    onUpdateOrder(rowNum, updates);
  };

  return (
    <div className="space-y-6 text-right animate-fade-in" dir="rtl">
      {/* Search and Action Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-semibold select-none transition-all ${
              isFilterOpen 
                ? "bg-blue-600/10 text-blue-400 border-blue-600/20" 
                : "bg-[#111930]/60 text-gray-400 border-white/5 hover:bg-white/5"
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>تصفية متطورة</span>
          </button>
          
          <div className="relative flex-1 md:w-80">
            <input
              type="text"
              placeholder="ابحث برقم الطلب، اسم العميل، الهاتف..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full bg-[#0d1426] border border-white/10 rounded-xl pr-10 pl-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
            />
            <Search className="w-4 h-4 text-gray-500 absolute right-3.5 top-3" />
          </div>
        </div>

        <button
          onClick={onAddSale}
          className="w-full md:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة طلب جديد</span>
        </button>
      </div>

      {/* Advanced Collapsible Filter Panel */}
      {isFilterOpen && (
        <div className="bg-[#111930]/65 border border-white/5 p-5 rounded-2xl gap-4 grid grid-cols-2 md:grid-cols-5 items-end glass-effect animate-slide-down">
          <div>
            <label className="block text-[11px] text-gray-400 mb-1.5 font-medium">النطاق الزمني</label>
            <div className="relative">
              <select
                value={selectedDateRange}
                onChange={e => { setSelectedDateRange(e.target.value); setCurrentPage(1); }}
                className="w-full bg-[#0d1426] border border-white/10 text-white rounded-xl px-3 py-2 text-xs appearance-none font-sans"
              >
                <option value="all">كل الأوقات</option>
                <option value="today">اليوم</option>
                <option value="yesterday">الأمس</option>
                <option value="week">آخر 7 أيام</option>
                <option value="month">الشهر الحالي</option>
                <option value="year">السنة الحالية</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-gray-400 mb-1.5 font-medium">الحالة (Condition)</label>
            <select
              value={selectedCondition}
              onChange={e => { setSelectedCondition(e.target.value); setCurrentPage(1); }}
              className="w-full bg-[#0d1426] border border-white/10 text-white rounded-xl px-3 py-2 text-xs"
            >
              <option value="">الكل</option>
              {CONDITIONS.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-gray-400 mb-1.5 font-medium">المدينة</label>
            <select
              value={selectedCity}
              onChange={e => { setSelectedCity(e.target.value); setCurrentPage(1); }}
              className="w-full bg-[#0d1426] border border-white/10 text-white rounded-xl px-3 py-2 text-xs"
            >
              <option value="">الكل</option>
              {cityOptions.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-gray-400 mb-1.5 font-medium">الموزع (Livreur)</label>
            <select
              value={selectedLivreur}
              onChange={e => { setSelectedLivreur(e.target.value); setCurrentPage(1); }}
              className="w-full bg-[#0d1426] border border-white/10 text-white rounded-xl px-3 py-2 text-xs"
            >
              <option value="">الكل</option>
              {livreurOptions.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleClearFilters}
            className="col-span-2 md:col-span-1 px-4 py-2 bg-white/5 border border-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all h-[36px]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>إعادة تعيين</span>
          </button>
        </div>
      )}

      {/* Main Grid Table Container */}
      <div className="bg-[#111930]/40 border border-white/5 rounded-2xl shadow-xl overflow-hidden glass-effect">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-[#0d1426] text-gray-400 text-[10px] font-bold uppercase tracking-wider border-b border-white/5 select-none font-mono">
              <tr>
                <th onClick={() => handleSort("Order ID")} className="px-5 py-4 cursor-pointer hover:bg-white/[0.05] transition-colors">
                  <div className="flex items-center gap-1 justify-start">
                    <span>الرقم</span>
                    {renderSortIcon("Order ID")}
                  </div>
                </th>
                <th onClick={() => handleSort("Order date")} className="px-5 py-4 cursor-pointer hover:bg-white/[0.05] transition-colors">
                  <div className="flex items-center gap-1 justify-start">
                    <span>التاريخ</span>
                    {renderSortIcon("Order date")}
                  </div>
                </th>
                <th onClick={() => handleSort("Full name")} className="px-5 py-4 cursor-pointer hover:bg-white/[0.05] transition-colors">
                  <div className="flex items-center gap-1 justify-start">
                    <span>العميل</span>
                    {renderSortIcon("Full name")}
                  </div>
                </th>
                <th onClick={() => handleSort("Phone")} className="px-5 py-4 cursor-pointer hover:bg-white/[0.05] transition-colors">
                  <div className="flex items-center gap-1 justify-start">
                    <span>الهاتف</span>
                    {renderSortIcon("Phone")}
                  </div>
                </th>
                <th onClick={() => handleSort("City")} className="px-5 py-4 cursor-pointer hover:bg-white/[0.05] transition-colors">
                  <div className="flex items-center gap-1 justify-start">
                    <span>المدينة</span>
                    {renderSortIcon("City")}
                  </div>
                </th>
                <th onClick={() => handleSort("Product name")} className="px-5 py-4 cursor-pointer hover:bg-white/[0.05] transition-colors">
                  <div className="flex items-center gap-1 justify-start">
                    <span>المنتج</span>
                    {renderSortIcon("Product name")}
                  </div>
                </th>
                <th onClick={() => handleSort("Variant price")} className="px-5 py-4 cursor-pointer hover:bg-white/[0.05] transition-colors font-sans">
                  <div className="flex items-center gap-1 justify-start">
                    <span>السعر</span>
                    {renderSortIcon("Variant price")}
                  </div>
                </th>
                <th onClick={() => handleSort("Condition")} className="px-5 py-4 cursor-pointer hover:bg-white/[0.05] transition-colors">
                  <div className="flex items-center gap-1 justify-start">
                    <span>الإجراء</span>
                    {renderSortIcon("Condition")}
                  </div>
                </th>
                <th onClick={() => handleSort("Livreur")} className="px-5 py-4 cursor-pointer hover:bg-white/[0.05] transition-colors">
                  <div className="flex items-center gap-1 justify-start">
                    <span>الموزع</span>
                    {renderSortIcon("Livreur")}
                  </div>
                </th>
                <th onClick={() => handleSort("delivery")} className="px-5 py-4 cursor-pointer hover:bg-white/[0.05] transition-colors">
                  <div className="flex items-center gap-1 justify-start">
                    <span>الحالة</span>
                    {renderSortIcon("delivery")}
                  </div>
                </th>
                <th className="px-5 py-4 text-center">
                  <span>خيارات</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs font-sans text-gray-200">
              {currentSales.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-5 py-16 text-center text-gray-500 font-medium">
                    لا تتوفر طلبيات مطابقة لمعايير البحث الحالية
                  </td>
                </tr>
              ) : (
                currentSales.map((sale, idx) => {
                  const rowNum = sale._rowNum || (idx + 2);
                  return (
                    <tr key={sale["Order ID"] + idx} className="hover:bg-white/[0.02] transition-colors group">
                      {/* Order ID */}
                      <td className="px-5 py-3.5 font-mono text-blue-400 font-bold tracking-wide cell-order-id select-all">
                        {sale["Order ID"]}
                      </td>

                      {/* Order date */}
                      <td className="px-5 py-3.5 text-gray-400 font-mono">
                        {formatDateDisplay(sale["Order date"])}
                      </td>

                      {/* Full Name */}
                      <td className="px-5 py-3.5 font-bold text-white max-w-[120px] truncate cell-fullname">
                        {sale["Full name"]}
                      </td>

                      {/* Phone */}
                      <td className="px-5 py-3.5 font-mono tracking-tight text-white/90">
                        {sale.Phone || "-"}
                      </td>

                      {/* City + Region */}
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-gray-100">{sale.City}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{sale.Region || sale.City}</div>
                      </td>

                      {/* Product CODE */}
                      <td className="px-5 py-3.5 max-w-[150px] truncate">
                        <span className="px-2 py-0.5 bg-white/5 border border-white/5 rounded text-gray-300 font-mono text-[10px] uppercase font-semibold">
                          {sale["Product name"]}
                        </span>
                      </td>

                      {/* Variant Price */}
                      <td className="px-5 py-3.5 font-mono font-bold text-gray-200">
                        {formatCurrency(sale["Variant price"] || 0)}
                      </td>

                      {/* Condition Selection Dropdown */}
                      <td className="px-3 py-3.5">
                        <select
                          value={sale.Condition || "Confirmed"}
                          onChange={e => handleInlineChange(rowNum, "Condition", e.target.value, sale)}
                          className="bg-[#0d1426] border border-white/10 text-white rounded-lg px-2 py-1 text-[11px] font-sans focus:border-blue-500/50"
                        >
                          {CONDITIONS.map(cond => (
                            <option key={cond.value} value={cond.value} className="bg-[#0f172a]">{cond.label}</option>
                          ))}
                        </select>
                      </td>

                      {/* Livreur Selection Dropdown */}
                      <td className="px-3 py-3.5">
                        <select
                          value={sale.Livreur || ""}
                          onChange={e => handleInlineChange(rowNum, "Livreur", e.target.value, sale)}
                          className="bg-[#0d1426] border border-white/10 text-white rounded-lg px-2 py-1 text-[11px] font-sans focus:border-blue-500/50"
                        >
                          <option value="" className="bg-[#0f172a] text-gray-500"> </option>
                          {LIVREURS.map(liv => (
                            <option key={liv} value={liv} className="bg-[#0f172a]">{liv}</option>
                          ))}
                        </select>
                      </td>

                      {/* Delivery Status Selection (Section 4.1 Sync Trigger) */}
                      <td className="px-3 py-3.5">
                        <select
                          value={sale.delivery || ""}
                          onChange={e => handleInlineChange(rowNum, "delivery", e.target.value, sale)}
                          className={`border rounded-lg px-2 py-1 text-[11px] font-medium font-sans focus:outline-none ${
                            !sale.delivery 
                              ? "bg-gray-900/30 text-gray-400 border-white/10"
                              : sale.delivery === "Delivered"
                              ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/30"
                              : "bg-red-950/40 text-rose-400 border-red-500/30"
                          }`}
                        >
                          <option value="" className="bg-[#0d1426] text-gray-400 italic">بانتظار الشحن</option>
                          {DELIVERY_STATUSES.map(stat => (
                            <option key={stat.value} value={stat.value} className="bg-[#0d1426] text-white">
                              {stat.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Action buttons (Row controls) */}
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex gap-1.5 items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                          {/* Edit Details */}
                          <button
                            onClick={() => onEditSale(sale)}
                            title="تعديل تفاصيل الطلب"
                            className="p-1.5 bg-white/5 hover:bg-blue-600/10 hover:text-blue-400 rounded-lg text-gray-400 transition-all border border-transparent hover:border-blue-500/15"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Call Client */}
                          {sale.Phone && (
                            <a
                              href={`tel:${sale.Phone}`}
                              title="اتصال هاتفي بالفور"
                              className="p-1.5 bg-white/5 hover:bg-cyan-600/10 hover:text-cyan-400 rounded-lg text-gray-400 transition-all border border-transparent hover:border-cyan-500/15"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {/* WhatsApp Chat */}
                          {sale.Phone && (
                            <a
                              href={generateWhatsAppUrl(sale.Phone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="محادثة واتساب سريعة"
                              className="p-1.5 bg-white/5 hover:bg-emerald-600/10 hover:text-emerald-400 rounded-lg text-gray-400 transition-all border border-transparent hover:border-emerald-500/15"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {/* Target Landing Page Target */}
                          {sale["Product URL"] && (
                            <a
                              href={sale["Product URL"]}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="رابط صفحة المبيعات بالمتجر"
                              className="p-1.5 bg-white/5 hover:bg-amber-600/10 hover:text-amber-400 rounded-lg text-gray-400 transition-all border border-transparent hover:border-amber-500/15"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Dynamic Footer with responsive pagination */}
        <div className="px-6 py-4 bg-[#0d1426] border-t border-white/5 flex flex-col sm:flex-row gap-4 items-center justify-between text-xs text-gray-400">
          <span className="font-mono">
            عرض {currentSales.length} طلبات من أصل {filteredSales.length} (إجمالي {sales.length} طلب بالملف)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 px-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1 text-[11px]"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              السابق
            </button>
            <div className="flex gap-1 items-center">
              {Array.from({ length: totalPages }).map((_, pageIdx) => {
                const pageNum = pageIdx + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`py-1 px-3 rounded-lg text-[11px] font-mono transition-all font-bold border ${
                      currentPage === pageNum
                        ? "bg-blue-600/10 text-blue-400 border-blue-500/20"
                        : "bg-white/5 text-gray-400 border-transparent hover:bg-white/10"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 px-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1 text-[11px]"
            >
              التالي
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for inline edits */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(p => ({ ...p, isOpen: false }))}
        type="warning"
      />
    </div>
  );
};

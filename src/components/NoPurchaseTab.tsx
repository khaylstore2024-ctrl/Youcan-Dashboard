import React, { useState, useMemo, useRef } from "react";
import { Order, Purchase } from "../types";
import { ProductImageMapperModal } from "./ProductImageMapperModal";
import { 
  formatDateDisplay, 
  generateWhatsAppUrl 
} from "../data";
import { 
  Search, 
  MessageSquare, 
  Copy, 
  Check, 
  ExternalLink, 
  Filter, 
  UserX, 
  AlertCircle, 
  PhoneOff, 
  RotateCcw,
  ArrowUpDown,
  ShoppingBag,
  SlidersHorizontal,
  X,
  Trash2,
  Upload,
  Link2,
  Image as ImageIcon,
  FileImage,
  HelpCircle,
  Sparkles,
  Layers,
  CheckCircle2
} from "lucide-react";

interface NoPurchaseTabProps {
  sales: Order[];
  purchases: Purchase[];
  onUpdateOrder?: (rowNum: number, updates: any) => void;
}

export const NoPurchaseTab: React.FC<NoPurchaseTabProps> = ({ sales, purchases, onUpdateOrder }) => {
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [reasonCategory, setReasonCategory] = useState<"all" | "cancelled_pre" | "no_response" | "returned" | "unreachable">("all");
  const [whatsappFilter, setWhatsappFilter] = useState<"all" | "not_sent" | "sent">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Sorting State
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");

  // Modern state for unreachable WhatsApp notification form modal
  const [unreachableModalOrder, setUnreachableModalOrder] = useState<Order | null>(null);
  const [unreachableParcel, setUnreachableParcel] = useState("");
  const [unreachableCourier, setUnreachableCourier] = useState(() => {
    return localStorage.getItem("khayl_unreachable_courier_default") || "";
  });
  const [unreachableProductName, setUnreachableProductName] = useState("");

  // WhatsApp Message Template state
  const [template, setTemplate] = useState(() => {
    const newDefault = "السلام عليكم {name}، معك فريق الدعم لمتجرنا خيل سطور بخصوص طلبكم لمنتج ({product}). لقد لاحظنا أنه لم يتم تأكيد طلبكم أو واجهتم مشكلة بالتوصيل. هل ما زلت مهتماً بالمنتج لنقوم بمساعدتكم؟\nرابط المنتج للمعاينة: {url}";
    try {
      const stored = localStorage.getItem("khayl_watrans_template");
      if (!stored) {
        return newDefault;
      }
      // Migrate old default (without brand name "خيل سطور") to the new one
      if (stored === "السلام عليكم {name}، معك فريق الدعم لمتجرنا بخصوص طلبكم لمنتج ({product}). لقد لاحظنا أنه لم يتم تأكيد طلبكم أو واجهتم مشكلة بالتوصيل. هل ما زلت مهتماً بالمنتج لنقوم بمساعدتكم؟\nرابط المنتج للمعاينة: {url}") {
        localStorage.setItem("khayl_watrans_template", newDefault);
        return newDefault;
      }
      return stored;
    } catch {
      return newDefault;
    }
  });

  // Dynamic Product Media & Link Configs (stored in local storage)
  const [mediaConfigs, setMediaConfigs] = useState<Record<string, { url: string; image?: string }>>(() => {
    try {
      const saved = localStorage.getItem("khayl_product_media_configs2");
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error("Failed to parse media configs", e);
      return {};
    }
  });
  
  // Unified settings control popup
  const [isUnifiedSettingsOpen, setIsUnifiedSettingsOpen] = useState(false);
  const [unifiedSettingsTab, setUnifiedSettingsTab] = useState<"single" | "batch" | "template">("template");

  // Helper functions or values used for copying or fallback mapping list 
  const [selectedProductCode, setSelectedProductCode] = useState("");
  const [productUrlInput, setProductUrlInput] = useState("");

  // Reload local state whenever changes happen or on modal load/close
  const reloadLocalConfigs = () => {
    try {
      const saved = localStorage.getItem("khayl_product_media_configs2");
      if (saved) setMediaConfigs(JSON.parse(saved));
    } catch {}
    try {
      const stored = localStorage.getItem("khayl_watrans_template");
      if (stored) setTemplate(stored);
    } catch {}
  };

  // Track copied state for text template
  const [copiedRow, setCopiedRow] = useState<number | null>(null);

  // Track copied state for phone number
  const [copiedPhoneRow, setCopiedPhoneRow] = useState<number | null>(null);

  // Track copied state for image clipboard
  const [copiedImageRow, setCopiedImageRow] = useState<number | null>(null);
  const [dashboardCopiedCode, setDashboardCopiedCode] = useState<string | null>(null);
  const [failedImageRow, setFailedImageRow] = useState<number | null>(null);
  const [dashboardFailedCode, setDashboardFailedCode] = useState<string | null>(null);

  // Map product code to product name to resolve the actual product name (Produit in purchases)
  const productCodeToNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    purchases.forEach(p => {
      if (p.Code && p.Produit) {
        map[p.Code.trim().toLowerCase()] = p.Produit.trim();
      }
    });
    return map;
  }, [purchases]);

  const getProductName = (productCode: string) => {
    if (!productCode) return "-";
    const normalized = productCode.trim().toLowerCase();
    return productCodeToNameMap[normalized] || productCode;
  };

  // Get all unique product codes from the sales / orders
  const uniqueProductCodes = useMemo(() => {
    const codesSet = new Set<string>();
    sales.forEach(sale => {
      const code = sale["Product name"] ? sale["Product name"].trim() : "";
      if (code) {
        codesSet.add(code);
      }
    });
    // Fallback: also load from purchases just in case
    purchases.forEach(p => {
      const code = p.Code ? p.Code.trim() : "";
      if (code) {
        codesSet.add(code);
      }
    });
    return Array.from(codesSet);
  }, [sales, purchases]);

  // Default active code inside dashboard
  useState(() => {
    if (uniqueProductCodes.length > 0 && !selectedProductCode) {
      setSelectedProductCode(uniqueProductCodes[0]);
    }
  });

  // 1. Identify "did not buy" sales
  const noPurchaseSales = useMemo(() => {
    return sales.filter(sale => {
      const condition = sale.Condition ? sale.Condition.trim() : "";
      const delivery = sale.delivery ? sale.delivery.trim() : "";
      const waSent = sale["WhatsApp Sent"] ? sale["WhatsApp Sent"].toString().trim() : "";

      // "غير مهتم" rows are no longer hidden; they appear even if they are selected as not interested.

      const isCancelledCondition = condition.toLowerCase() === "anule" || condition.toLowerCase() === "annulé";
      const isNoResponse = condition.toLowerCase() === "ne repond pas" || condition.toLowerCase() === "ne répond pas" || condition.toLowerCase() === "call again";
      const isReturnedDelivery = delivery.toLowerCase() === "retour" || delivery.toLowerCase() === "annuler" || delivery.toLowerCase() === "annulé sur place" || delivery.toLowerCase() === "annulé au téléphone";
      const isUnreachableDelivery = delivery.toLowerCase() === "client injoignable";

      return isCancelledCondition || isNoResponse || isReturnedDelivery || isUnreachableDelivery;
    });
  }, [sales]);

  // 2. Classify categorized lists
  const categorizedSales = useMemo(() => {
    return noPurchaseSales.map(sale => {
      const condition = sale.Condition ? sale.Condition.trim().toLowerCase() : "";
      const delivery = sale.delivery ? sale.delivery.trim().toLowerCase() : "";

      let category: "cancelled_pre" | "no_response" | "returned" | "unreachable" = "cancelled_pre";
      let displayReason = "ملغى";

      if (condition === "anule" || condition === "annulé") {
        category = "cancelled_pre";
        displayReason = "ملغى قبل الشحن (Condition: Annulé)";
      } else if (condition === "ne repond pas" || condition === "ne répond pas" || condition === "call again") {
        category = "no_response";
        displayReason = "لم يرد على الاتصال (Rappeler / Ne répond pas)";
      } else if (delivery === "retour" || delivery === "annulé sur place") {
        category = "returned";
        displayReason = "مرتجع أو مرفوض عند التسليم (Retour)";
      } else if (delivery === "annuler" || delivery === "annulé au téléphone") {
        category = "returned";
        displayReason = "ملغى بعد توجيهه للتسليم (Annulé)";
      } else if (delivery === "client injoignable") {
        category = "unreachable";
        displayReason = "العميل غير متاح / تعذر الاتصال (Injoignable)";
      } else {
        // Fallback checks
        if (delivery) {
          category = "returned";
          displayReason = `فشل تسليم (${sale.delivery})`;
        } else {
          category = "no_response";
          displayReason = `قيد المتابعة (${sale.Condition})`;
        }
      }

      return {
        ...sale,
        category,
        displayReason
      };
    });
  }, [noPurchaseSales]);

  // 3. Stats calculation
  const stats = useMemo(() => {
    const totalCount = sales.length || 1;
    const failedCount = categorizedSales.length;
    const preCount = categorizedSales.filter(s => s.category === "cancelled_pre").length;
    const returnCount = categorizedSales.filter(s => s.category === "returned").length;
    const noRespCount = categorizedSales.filter(s => s.category === "no_response").length;
    const unreachCount = categorizedSales.filter(s => s.category === "unreachable").length;

    return {
      total: failedCount,
      preShipping: preCount,
      postShipping: returnCount,
      noResponse: noRespCount,
      unreachable: unreachCount,
      lossRatio: (failedCount / totalCount) * 100
    };
  }, [sales, categorizedSales]);

  // 4. Advanced filtration
  const filteredSales = useMemo(() => {
    let list = categorizedSales;

    if (reasonCategory !== "all") {
      list = list.filter(item => item.category === reasonCategory);
    }

    if (whatsappFilter !== "all") {
      list = list.filter(item => {
        const isSent = item["WhatsApp Sent"] === "نعم" || (item["WhatsApp Count"] !== undefined && item["WhatsApp Count"] > 0);
        if (whatsappFilter === "sent") {
          return isSent;
        } else {
          return !isSent;
        }
      });
    }

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      list = list.filter(item => {
        const prodCode = item["Product name"] || "";
        const prodName = getProductName(prodCode);
        return (
          (item["Full name"] || "").toLowerCase().includes(q) ||
          (item["Phone"] || "").toLowerCase().includes(q) ||
          (item["City"] || "").toLowerCase().includes(q) ||
          prodCode.toLowerCase().includes(q) ||
          prodName.toLowerCase().includes(q)
        );
      });
    }

    // Sort by order date
    list.sort((a, b) => {
      const dateA = new Date(a["Order date"]).getTime() || 0;
      const dateB = new Date(b["Order date"]).getTime() || 0;
      return sortDirection === "desc" ? dateB - dateA : dateA - dateB;
    });

    return list;
  }, [categorizedSales, reasonCategory, searchQuery, sortDirection, productCodeToNameMap, whatsappFilter]);

  // Pagination logic
  const totalPages = Math.ceil(filteredSales.length / itemsPerPage) || 1;
  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSales.slice(start, start + itemsPerPage);
  }, [filteredSales, currentPage]);

  const toggleSort = () => {
    setSortDirection(prev => prev === "desc" ? "asc" : "desc");
    setCurrentPage(1);
  };

  // Convert uploaded file to optimized base64 PNG string
  const compressAndSaveImage = (productCode: string, file: File) => {
    if (!productCode) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        // Maintain proportions with standard width of 350px - ideal file size/resolution ratio for Clipboard
        const MAX_WIDTH = 350;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          // Export as PNG for high reliability in browser clipboards
          const compressedBase64 = canvas.toDataURL("image/png");
          
          setMediaConfigs(prev => {
            const key = productCode.trim().toLowerCase();
            const updated = {
              ...prev,
              [key]: {
                ...prev[key],
                image: compressedBase64
              }
            };
            localStorage.setItem("khayl_product_media_configs2", JSON.stringify(updated));
            return updated;
          });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Triggered when manual table row uploads photo
  const handleQuickUpload = (productCode: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      compressAndSaveImage(productCode, file);
    }
  };

  // Set individual text store link inside memory
  const saveProductStoreUrl = (productCode: string, url: string) => {
    if (!productCode) return;
    setMediaConfigs(prev => {
      const key = productCode.trim().toLowerCase();
      const updated = {
        ...prev,
        [key]: {
          ...prev[key],
          url: url.trim()
        }
      };
      localStorage.setItem("khayl_product_media_configs2", JSON.stringify(updated));
      return updated;
    });
  };

  const removeImage = (productCode: string) => {
    setMediaConfigs(prev => {
      const key = productCode.trim().toLowerCase();
      const updated = { ...prev };
      if (updated[key]) {
        updated[key] = {
          ...updated[key],
          image: undefined
        };
      }
      localStorage.setItem("khayl_product_media_configs2", JSON.stringify(updated));
      return updated;
    });
  };

  // Convert any image (including JPEGs/WebPs) to a strict PNG Blob via canvas
  const convertToPngBlob = (base64OrUrl: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas context is not available"));
            return;
          }
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("toBlob returned null"));
            }
          }, "image/png");
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = (err) => {
        reject(new Error("Failed to load image element for PNG conversion"));
      };
      img.src = base64OrUrl;
    });
  };

  // Copy an image directly from its Base64 string to the user's OS system clipboard
  const copyImageToClipboard = async (
    base64String: string | undefined, 
    indexOrCode: string | number, 
    isAutomatic = false,
    textToCopy?: string
  ) => {
    // Attempt to clear/reset the clipboard beforehand to avoid OS registration lag or stale entries
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText("");
      }
    } catch (e) {
      console.warn("Could not clear clipboard beforehand:", e);
    }

    if (!base64String) {
      if (textToCopy) {
        try {
          await navigator.clipboard.writeText(textToCopy);
        } catch (e) {
          console.warn("Direct text clipboard copying failed.", e);
        }
      }
      return;
    }

    try {
      // Convert image to strict image/png Blob using our Canvas-based helper
      const pngBlob = await convertToPngBlob(base64String);

      // Convert or construct appropriate Clipboard data structure
      const clipboardData: Record<string, Blob> = {
        "image/png": pngBlob
      };

      if (textToCopy) {
        clipboardData["text/plain"] = new Blob([textToCopy], { type: "text/plain" });
      }

      await navigator.clipboard.write([
        new ClipboardItem(clipboardData)
      ]);

      if (typeof indexOrCode === "number") {
        setCopiedImageRow(indexOrCode);
        setFailedImageRow(null);
        setTimeout(() => setCopiedImageRow(null), 2500);
      } else {
        setDashboardCopiedCode(indexOrCode);
        setDashboardFailedCode(null);
        setTimeout(() => setDashboardCopiedCode(null), 2550);
      }
    } catch (err) {
      console.warn("Direct image clipboard copying failed. Trying fallback to text-only copying and clean PNG-only image write.", err);
      
      // Fallback 1: Try writing JUST the image in PNG format without text (some browsers do not support multi-mime ClipboardItems)
      try {
        const pngBlob = await convertToPngBlob(base64String);
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": pngBlob })
        ]);
        
        // If that succeeded, let them know, but also copy text next as a separate step or warn
        if (typeof indexOrCode === "number") {
          setCopiedImageRow(indexOrCode);
          setFailedImageRow(null);
          setTimeout(() => setCopiedImageRow(null), 2500);
        } else {
          setDashboardCopiedCode(indexOrCode);
          setDashboardFailedCode(null);
          setTimeout(() => setDashboardCopiedCode(null), 2550);
        }
        
        // Try saving text to key text field afterwards
        if (textToCopy) {
          try {
            await navigator.clipboard.writeText(textToCopy);
          } catch(e) {}
        }
        return;
      } catch (fallbackErr) {
        console.warn("Fallback PNG-only copy failed too:", fallbackErr);
      }

      // If all image copy options failed, fall back to writing plain text (highly supported)
      if (textToCopy) {
        try {
          await navigator.clipboard.writeText(textToCopy);
        } catch (textErr) {
          console.error("Even text-only fallback copying failed:", textErr);
        }
      }

      // If NOT automatic and failed, display the inline failed badge temporarily
      if (!isAutomatic) {
        if (typeof indexOrCode === "number") {
          setFailedImageRow(indexOrCode);
          setTimeout(() => setFailedImageRow(null), 4000);
        } else {
          setDashboardFailedCode(indexOrCode);
          setTimeout(() => setDashboardFailedCode(null), 4000);
        }
      }
    }
  };

  // Build the personalized WhatsApp Click-to-Chat URL
  const getPersonalizedWhatsAppUrl = (clientName: string, productCode: string, phone: string, fallbackUrl: string) => {
    const productName = getProductName(productCode);
    const key = productCode.trim().toLowerCase();
    const productUrl = mediaConfigs[key]?.url || fallbackUrl || "";

    const formattedMessage = template
      .replace(/{name}/g, clientName || "العميل")
      .replace(/{product}/g, productName || "المنتج")
      .replace(/{url}/g, productUrl || "");

    return generateWhatsAppUrl(phone) + "?text=" + encodeURIComponent(formattedMessage);
  };

  // Copy the pre-filled custom text using product fully converted names
  const handleCopyText = (clientName: string, productCode: string, rowNum: number | undefined, fallbackUrl: string) => {
    if (rowNum === undefined) return;
    
    const productName = getProductName(productCode);
    const key = productCode.trim().toLowerCase();
    const productUrl = mediaConfigs[key]?.url || fallbackUrl || "";

    const formattedMessage = template
      .replace(/{name}/g, clientName || "العميل")
      .replace(/{product}/g, productName || "المنتج")
      .replace(/{url}/g, productUrl || "");

    navigator.clipboard.writeText(formattedMessage);
    setCopiedRow(rowNum);
    setTimeout(() => {
      setCopiedRow(null);
    }, 2500);
  };

  return (
    <div className="space-y-6 text-right animate-fade-in" dir="rtl">
      
      {/* 1. TOP STATS ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6" id="no-purchase-kpi">
        {/* Card 1: إجمالي عملاء لم يشتروا */}
        <div className="bg-[#111930]/60 border border-white/5 p-5 rounded-2xl relative overflow-hidden glass-effect">
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-500"></div>
          <div className="text-gray-400 text-xs font-semibold mb-1">إجمالي عملاء لم يشتروا</div>
          <div className="text-2xl font-black font-mono tracking-tight text-red-400">
            {stats.total} <span className="text-xs font-normal text-gray-400">عميل في القائمة</span>
          </div>
          <div className="mt-2 text-[10px] text-gray-500">يشمل الإلغاء، المرتجعات، وعدم الرد</div>
        </div>

        {/* Card 2: إلغاء قبل الشحن */}
        <div className="bg-[#111930]/60 border border-white/5 p-5 rounded-2xl relative overflow-hidden glass-effect">
          <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500"></div>
          <div className="text-gray-400 text-xs font-semibold mb-1">ملغي قبل الشحن (Annulé)</div>
          <div className="text-2xl font-black font-mono tracking-tight text-rose-400">
            {stats.preShipping} <span className="text-xs font-normal text-gray-400">طلب</span>
          </div>
          <div className="mt-2 text-[10px] text-gray-500">إلغاء فوري بعد المكالمة أو عبر الهاتف</div>
        </div>

        {/* Card 3: مرتجعات بعد الشحن */}
        <div className="bg-[#111930]/60 border border-white/5 p-5 rounded-2xl relative overflow-hidden glass-effect">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500"></div>
          <div className="text-gray-400 text-xs font-semibold mb-1">المرتجع والمرفوض (Retour)</div>
          <div className="text-2xl font-black font-mono tracking-tight text-amber-500">
            {stats.postShipping} <span className="text-xs font-normal text-gray-400">شحنة مرتجعة</span>
          </div>
          <div className="mt-2 text-[10px] text-gray-500">شحنات خرجت للتوزيع وتم رفضها/إرجاعها</div>
        </div>

        {/* Card 4: نسبة الخسارة الإجمالية */}
        <div className="bg-[#111930]/60 border border-white/5 p-5 rounded-2xl relative overflow-hidden glass-effect">
          <div className="absolute top-0 left-0 right-0 h-1 bg-violet-500"></div>
          <div className="text-gray-400 text-xs font-semibold mb-1">معدل تعثر المبيعات الكلي</div>
          <div className="text-2xl font-black font-mono tracking-tight text-violet-400">
            {stats.lossRatio.toFixed(1)}%
          </div>
          <div className="mt-2 text-[10px] text-gray-500">نسبة الطلاب الغير مكتملة من إجمالي الملف</div>
        </div>
      </div>

      {/* 2. MAIN CONTAINER: LIST & FILTERS */}
      <div className="bg-[#111930]/40 border border-white/5 rounded-2xl shadow-xl overflow-hidden glass-effect">
        
        {/* Table Header Filter controls */}
        <div className="p-5 border-b border-white/5 flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center w-full lg:w-auto">
            {/* All */}
            <button
              onClick={() => { setReasonCategory("all"); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                reasonCategory === "all"
                  ? "bg-blue-600/10 text-blue-400 border border-blue-500/20"
                  : "bg-[#0d1426] text-gray-400 border border-transparent hover:text-white"
              }`}
            >
              الكل ({stats.total})
            </button>

            {/* Cancelled Pre shipping */}
            <button
              onClick={() => { setReasonCategory("cancelled_pre"); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                reasonCategory === "cancelled_pre"
                  ? "bg-rose-600/10 text-rose-400 border border-rose-500/20"
                  : "bg-[#0d1426] text-gray-400 border border-transparent hover:text-white"
              }`}
            >
              ملغي قبل الشحن ({stats.preShipping})
            </button>

            {/* Returned Delivery */}
            <button
              onClick={() => { setReasonCategory("returned"); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                reasonCategory === "returned"
                  ? "bg-amber-600/10 text-amber-400 border border-amber-500/20"
                  : "bg-[#0d1426] text-gray-400 border border-transparent hover:text-white"
              }`}
            >
              المرتجعات والمرفوضة ({stats.postShipping})
            </button>

            {/* No Response */}
            <button
              onClick={() => { setReasonCategory("no_response"); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                reasonCategory === "no_response"
                  ? "bg-purple-600/10 text-purple-400 border border-purple-500/20"
                  : "bg-[#0d1426] text-gray-400 border border-transparent hover:text-white"
              }`}
            >
              لم يرد على الاتصال ({stats.noResponse})
            </button>

            {/* Injoignable */}
            <button
              onClick={() => { setReasonCategory("unreachable"); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                reasonCategory === "unreachable"
                  ? "bg-orange-600/10 text-orange-400 border border-orange-500/20"
                  : "bg-[#0d1426] text-gray-400 border border-transparent hover:text-white"
              }`}
            >
              تعذر الاتصال به ({stats.unreachable})
            </button>
          </div>

          {/* Search bar & Smart Dash Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-stretch sm:items-center">
            
            {/* WhatsApp Filter Select Dropdown */}
            <div className="relative">
              <select
                value={whatsappFilter}
                onChange={(e) => { setWhatsappFilter(e.target.value as any); setCurrentPage(1); }}
                className="bg-[#000411]/90 border border-white/10 text-xs rounded-xl px-4 py-2.5 text-gray-200 font-bold focus:outline-none focus:border-blue-500/50 cursor-pointer min-w-[200px]"
              >
                <option value="all" className="bg-[#0f172a] text-white">جميع حالات الواتساب (الكل)</option>
                <option value="sent" className="bg-[#0f172a] text-white">تم الإرسال ☑️</option>
                <option value="not_sent" className="bg-[#0f172a] text-white">لم يتم الإرسال ❌</option>
              </select>
            </div>

            {/* Search inputs */}
            <div className="relative flex-1 sm:w-60">
              <span className="absolute right-3 top-2.5 text-gray-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="البحث بالاسم، الهاتف، المدينة..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full bg-[#0d1426] border border-white/10 text-xs rounded-xl pr-9 pl-4 py-2.5 text-white focus:outline-none focus:border-blue-500/50 placeholder-gray-500"
              />
            </div>



          </div>
        </div>

        {/* The data Table element */}
        <div className="overflow-x-auto">
          {filteredSales.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 bg-white/5 text-gray-500 rounded-full flex items-center justify-center">
                <UserX className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-gray-300">لا يوجد عملاء يطابقون خيارات الفلترة الحالية</h4>
              <p className="text-xs text-gray-500 max-w-sm">تحقق من كتابة الاسم والخيارات المسجلة لملف الأوردرات.</p>
            </div>
          ) : (
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/5 text-slate-400 text-[11px] font-bold">
                  <th className="px-5 py-4">العميل</th>
                  <th className="px-5 py-4">رقم الهاتف</th>
                  <th className="px-5 py-4 font-sans">معاينة الصورة والوسائط</th>
                  <th className="px-5 py-4">رمز المنتج</th>
                  <th className="px-5 py-4">اسم المنتج المستورد</th>
                  <th className="px-5 py-4 cursor-pointer hover:bg-white/[0.05]" onClick={toggleSort}>
                    <div className="flex items-center gap-1.5">
                      <span>تاريخ الطلب</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-5 py-4">المدينة</th>
                  <th className="px-5 py-4">حالة الاهتمام</th>
                  <th className="px-5 py-4 text-center">إجراءات المراسلة الفورية والنسخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-gray-300">
                {paginatedSales.map((sale, idx) => {
                  const rNum = sale._rowNum !== undefined ? sale._rowNum : idx;
                  const isTextCopied = copiedRow === rNum;
                  const isImgCopied = copiedImageRow === rNum;
                  const isImgFailed = failedImageRow === rNum;

                  const productCode = sale["Product name"] || "";
                  const productName = getProductName(productCode);
                  const normalizedKey = productCode.trim().toLowerCase();
                  
                  // Extract config link/image if present
                  const customConfig = mediaConfigs[normalizedKey];
                  const hasCustomImage = !!customConfig?.image;
                  const activeStoreUrl = customConfig?.url || sale["Product URL"] || "";

                  // Get category styled badges
                  let categoryBadgeClass = "bg-rose-950/40 text-rose-400 border-rose-500/10";
                  if (sale.category === "no_response") {
                    categoryBadgeClass = "bg-purple-950/40 text-purple-400 border-purple-500/10";
                  } else if (sale.category === "returned") {
                    categoryBadgeClass = "bg-amber-950/40 text-amber-400 border-amber-500/15";
                  } else if (sale.category === "unreachable") {
                    categoryBadgeClass = "bg-orange-950/40 text-orange-400 border-orange-500/15";
                  }

                  return (
                    <tr key={rNum} className="hover:bg-white/[0.02] transition-colors bg-[#080d19]/10">
                      
                      {/* Name of buyer */}
                      <td className="px-5 py-4 font-bold text-white font-sans">
                        <span>{sale["Full name"] || "عميل بدون اسم"}</span>
                      </td>

                      {/* Contact phone number */}
                      <td 
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (sale.Phone) {
                            try {
                              await navigator.clipboard.writeText(sale.Phone);
                              setCopiedPhoneRow(rNum);
                              setTimeout(() => setCopiedPhoneRow(null), 2000);
                            } catch (err) {
                              console.error("Failed to copy phone:", err);
                            }
                          }
                        }}
                        className="px-5 py-4 font-mono font-medium tracking-wide cursor-pointer hover:text-emerald-400 active:scale-95 transition-all relative group"
                        title="انقر لنسخ رقم الهاتف"
                      >
                        <div className="flex items-center gap-1.5 justify-end">
                          <span>{sale.Phone || "لا يوجد رقم"}</span>
                          {copiedPhoneRow === rNum ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-sans bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 scale-90">
                              تم النسخ!
                            </span>
                          ) : (
                            <Copy className="w-3 h-3 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                      </td>

                      {/* PRODUCT IMAGE FLOW (with Copy/Paste setup) - NEW! */}
                      <td className="px-5 py-4">
                        {hasCustomImage ? (
                          <div className="flex items-center gap-2 group">
                            
                            {/* Zoomable Image Thumbnail */}
                            <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-[#0d1426]">
                              <img 
                                src={customConfig.image} 
                                alt={productName} 
                                className="w-full h-full object-cover transition-transform group-hover:scale-125"
                              />
                            </div>

                          </div>
                        ) : (
                          // Fallback upload directly inside table row
                          <div className="flex items-center gap-1.5">
                            <label className="cursor-pointer h-7 px-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[10px] text-gray-400 font-bold flex items-center gap-1 transition-colors">
                              <Upload className="w-3 h-3 text-slate-400" />
                              <span>+ أضف صورة</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={(e) => handleQuickUpload(productCode, e)} 
                              />
                            </label>
                            <span className="text-[9px] text-gray-500">لا يوجد صورة</span>
                          </div>
                        )}
                      </td>

                      {/* Product Code */}
                      <td className="px-5 py-4 font-mono text-gray-400 text-[11px]">
                        <span className="bg-white/5 px-2.5 py-1 rounded border border-white/5 font-sans font-bold">
                          {productCode || "-"}
                        </span>
                      </td>

                      {/* PRODUCT NAME COLUMN */}
                      <td className="px-5 py-4 font-bold text-sky-400 font-sans max-w-[180px] truncate" title={productName}>
                        <div className="flex items-center gap-1.5">
                          <ShoppingBag className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                          <span className="truncate">{productName}</span>
                        </div>
                      </td>

                      {/* Timestamp of order */}
                      <td className="px-5 py-4 font-mono text-gray-400 text-[11px]">
                        {formatDateDisplay(sale["Order date"])}
                      </td>

                      {/* City location */}
                      <td className="px-5 py-4 font-sans text-gray-300 text-[11px]">
                        {sale.City || "غير محدد"}
                      </td>

                      {/* Delivery Status & Order Condition Dropdown column */}
                      <td className="px-5 py-4">
                        {/* Delivery Dropdown select */}
                        <select
                          value={sale["WhatsApp Sent"] === "Pas intéresse" || sale["WhatsApp Sent"] === "غير مهتم" ? "غير مهتم" : "مهتم"}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (sale._rowNum !== undefined && onUpdateOrder) {
                              onUpdateOrder(sale._rowNum, { "WhatsApp Sent": val === "غير مهتم" ? "غير مهتم" : "مهتم" });
                            }
                          }}
                          className="bg-[#0c1325]/90 text-gray-200 border border-white/10 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer text-xs font-semibold hover:bg-[#111930] duration-200 w-full min-w-[150px]"
                        >
                          <option value="مهتم" className="bg-[#0f172a] text-white">مهتم</option>
                          <option value="غير مهتم" className="bg-[#0f172a] text-white">غير مهتم</option>
                        </select>
                      </td>

                      {/* Double Actions for instant message */}
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-2">
                          
                          {/* Trigger Direct WhatsApp click with text params */}
                          <button
                            onClick={async (e) => {
                              e.preventDefault();
                              const clientName = sale["Full name"];
                              const pName = getProductName(productCode);
                              const pKey = productCode.trim().toLowerCase();
                              const pUrl = mediaConfigs[pKey]?.url || sale["Product URL"] || "";
                              
                              const formattedMessage = template
                                .replace(/{name}/g, clientName || "العميل")
                                .replace(/{product}/g, pName || "المنتج")
                                .replace(/{url}/g, pUrl || "");

                              if (hasCustomImage) {
                                await copyImageToClipboard(customConfig.image, rNum, true, formattedMessage);
                              } else {
                                try {
                                  await navigator.clipboard.writeText(formattedMessage);
                                } catch (err) {
                                  console.warn("Direct text clipboard copying failed.", err);
                                }
                              }

                              // Sync updated contacted status with server rows
                              if (sale._rowNum !== undefined && onUpdateOrder) {
                                const currentCount = sale["WhatsApp Count"] || 0;
                                onUpdateOrder(sale._rowNum, { 
                                  "WhatsApp Count": currentCount + 1 
                                });
                              }
                              
                              const waUrl = getPersonalizedWhatsAppUrl(clientName, productCode, sale.Phone, sale["Product URL"]);
                              window.open(waUrl, "_blank", "noopener,noreferrer");
                            }}
                            className="h-8 px-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 hover:shadow-lg hover:shadow-green-900/10 text-white rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                            title="مراسلة سريعة: سيقوم بفتح المحادثة بالواتساب بنص الرسالة مكتوباً تلقائياً والنسخ الذاتي للصور وتهيئة الحافظة لتتمكن من لصقها فوراً باستعمال Ctrl + V"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>مراسلة واتساب ({sale["WhatsApp Count"] || 0})</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </button>

                          {/* Unreachable / Connection issue specialized button */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setUnreachableParcel("");
                              setUnreachableProductName(getProductName(sale["Product name"] || ""));
                              setUnreachableModalOrder(sale);
                            }}
                            className="h-8 px-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 hover:shadow-lg hover:shadow-amber-900/10 text-white rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer border border-amber-500/20"
                            title="تنبيه تعذر الاتصال: إرسال رسالة مخصصة للعميل الذي تعذر الاتصال به مع إرفاق رقم الموزع ورقم الحوالة/الطرد للاتصال به لتسلم شحنته"
                          >
                            <PhoneOff className="w-3.5 h-3.5 shrink-0" />
                            <span>تنبيه الاتصال ({sale["Unreachable Count"] || 0})</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60 shrink-0" />
                          </button>

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Table Footer with Pagination controls */}
        {filteredSales.length > 0 && (
          <div className="p-4 border-t border-white/5 bg-[#090d19]/40 flex flex-col sm:flex-row justify-between items-center gap-4">
            <span className="text-xs text-slate-400">
              عرض <strong className="text-white">{(currentPage - 1) * itemsPerPage + 1}</strong> إلى{" "}
              <strong className="text-white">
                {Math.min(currentPage * itemsPerPage, filteredSales.length)}
              </strong>{" "}
              من <strong className="text-white">{filteredSales.length}</strong> عملاء
            </span>

            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-[#0d1426] hover:bg-white/5 disabled:opacity-40 border border-white/10 rounded-lg text-xs font-semibold text-gray-300 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                السابق
              </button>
              
              <div className="flex gap-1 items-center px-2">
                <span className="text-xs text-gray-400 font-mono">
                  {currentPage} / {totalPages}
                </span>
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-[#0d1426] hover:bg-white/5 disabled:opacity-40 border border-white/10 rounded-lg text-xs font-semibold text-gray-300 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. UNITED CORE CONTROL HUB MODAL */}
      {isUnifiedSettingsOpen && (
        <ProductImageMapperModal
          sales={sales}
          purchases={purchases}
          onClose={() => {
            setIsUnifiedSettingsOpen(false);
            reloadLocalConfigs();
          }}
          onSaved={() => {
            reloadLocalConfigs();
          }}
          initialTab={unifiedSettingsTab}
        />
      )}

      {/* 4. SPECIALIZED UNREACHABLE/CONNECTION PROBLEM WHATSAPP MODAL */}
      {unreachableModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" dir="rtl">
          <div className="bg-[#111930] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative">
            
            {/* Header */}
            <div className="p-5 border-b border-white/5 flex items-center justify-between bg-gradient-to-l from-amber-600/10 to-transparent">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center">
                  <PhoneOff className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">إرسال تنبيه تعذر الاتصال (واتساب)</h3>
                  <p className="text-[10px] text-gray-400">إشعار المشتري بوجود عقبة في الاتصال هاتفياً لتنسيق تسليم الشحنة</p>
                </div>
              </div>
              <button
                onClick={() => setUnreachableModalOrder(null)}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
                id="close-unreachable-modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Form */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                
                // Save inputs to localStorage for future default
                localStorage.setItem("khayl_unreachable_courier_default", unreachableCourier);

                const prodCode = unreachableModalOrder["Product name"] || "";
                const clientName = unreachableModalOrder["Full name"] || "العميل";
                const pName = unreachableProductName || getProductName(prodCode) || "المنتج";
                const pKey = prodCode.trim().toLowerCase();
                const customConfig = mediaConfigs[pKey];
                const hasCustomImage = !!customConfig?.image;

                // Build the precise message template requested by the user
                const formattedMessage = `السلام عليكم ${clientName}،\n\nبخصوص طلبكم: ${pName}\n\nرقم الطرد: ${unreachableParcel}\n\nتمت محاولة الاتصال بكم من طرف الموزع لتسليم الطلب، لكن تعذر التواصل معكم لأن الهاتف كان مغلقًا أو كانت هناك مشكلة في الاتصال.\n\nالمرجو الاتصال بالموزع على الرقم: ${unreachableCourier} لتنسيق عملية التسليم في أقرب وقت.\n\nشكرًا لتعاونكم.`;

                // Set clipboard
                if (hasCustomImage) {
                  const rNum = unreachableModalOrder._rowNum ?? 9999;
                  await copyImageToClipboard(customConfig.image, rNum, true, formattedMessage);
                } else {
                  try {
                    await navigator.clipboard.writeText(formattedMessage);
                  } catch (err) {
                    console.warn("Direct text clipboard copying failed.", err);
                  }
                }

                // Increment Unreachable Sent Count
                if (unreachableModalOrder._rowNum !== undefined && onUpdateOrder) {
                  const currentCount = unreachableModalOrder["Unreachable Count"] || 0;
                  onUpdateOrder(unreachableModalOrder._rowNum, { 
                    "Unreachable Count": currentCount + 1 
                  });
                }

                // Launch WhatsApp click-to-chat
                const waUrl = generateWhatsAppUrl(unreachableModalOrder.Phone) + "?text=" + encodeURIComponent(formattedMessage);
                window.open(waUrl, "_blank", "noopener,noreferrer");

                // Dismiss modal
                setUnreachableModalOrder(null);
              }}
              className="p-6 space-y-4 text-right"
            >
              {/* Row Details Card */}
              <div className="bg-[#0b101f] border border-white/5 rounded-xl p-4 space-y-2">
                <div className="grid grid-cols-2 gap-3 text-xs text-right">
                  <div className="text-right">
                    <span className="text-gray-400 block mb-0.5">اسم العميل (الزبون):</span>
                    <strong className="text-white font-sans">{unreachableModalOrder["Full name"] || "غير متوفر"}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-400 block mb-0.5">رقم هاتف العميل:</span>
                    <strong className="text-emerald-400 font-mono tracking-wider">{unreachableModalOrder.Phone || "غير متوفر"}</strong>
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="text-gray-400 block mb-0.5">المنتج المطلوب:</span>
                    <strong className="text-sky-450 font-sans">{getProductName(unreachableModalOrder["Product name"] || "")}</strong>
                  </div>
                </div>
              </div>

              {/* Editable Fields */}
              <div className="space-y-4">
                <div className="text-right">
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    اسم المنتج (تلقائي / قابل للتعديل): <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="اسم المنتج المراد إرساله"
                    value={unreachableProductName}
                    onChange={(e) => setUnreachableProductName(e.target.value)}
                    className="w-full bg-[#0d1426] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-sans text-right"
                  />
                </div>

                <div className="text-right">
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    رقم الحوالة / رقم الطرد (أدخله يدوياً إن توفر):
                  </label>
                  <input
                    type="text"
                    placeholder="يمكنك تركه فارغاً أو كتابته"
                    value={unreachableParcel}
                    onChange={(e) => setUnreachableParcel(e.target.value)}
                    className="w-full bg-[#0d1426] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono text-right"
                  />
                </div>

                <div className="text-right">
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    رقم هاتف الموصل / الليفرور (أدخله يدوياً): <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: +2126XXXXXXXX"
                    value={unreachableCourier}
                    onChange={(e) => setUnreachableCourier(e.target.value)}
                    className="w-full bg-[#0d1426] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-emerald-400 font-mono tracking-wide text-left"
                    dir="ltr"
                  />
                  <p className="text-[10px] text-gray-500 mt-1 text-right">يمكنك تعيين رقم الموصل ليتصل به المشتري لتسليم شحنته.</p>
                </div>
              </div>

              {/* Message Live Preview box */}
              <div className="text-right">
                <span className="block text-xs font-bold text-gray-400 mb-1.5">معاينة الرسالة المرتقبة:</span>
                <div className="bg-[#090d19] border border-white/5 rounded-xl p-4 text-[11px] text-gray-300 font-sans leading-relaxed whitespace-pre-line max-h-40 overflow-y-auto text-right" dir="rtl">
                  {`السلام عليكم ${unreachableModalOrder["Full name"] || "[اسم الزبون]"}،

بخصوص طلبكم: ${unreachableProductName || "[اسم المنتج]"}

رقم الطرد: ${unreachableParcel || "[رقم الطرد]"}

تمت محاولة الاتصال بكم من طرف الموزع لتسليم الطلب، لكن تعذر التواصل معكم لأن الهاتف كان مغلقًا أو كانت هناك مشكلة في الاتصال.

المرجو الاتصال بالموزع على الرقم: ${unreachableCourier || "[رقم هاتف الليفرور]"} لتنسيق عملية التسليم في أقرب وقت.

شكرًا لتعاونكم.`}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setUnreachableModalOrder(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-bold transition-all min-w-[80px]"
                >
                  إلغاء الأمر
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md shadow-green-950/10"
                >
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <span>تأكيد الإرسال بالواتساب ⚡</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

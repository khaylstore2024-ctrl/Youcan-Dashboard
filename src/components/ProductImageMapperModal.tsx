import React, { useState, useMemo, useRef } from "react";
import { Order, Purchase } from "../types";
import { 
  X, 
  Upload, 
  Search, 
  Sparkles, 
  Check, 
  Trash2, 
  Image as ImageIcon, 
  FolderOpen, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  ArrowLeftRight,
  RefreshCw,
  FolderSync,
  Plus,
  MessageSquare,
  AlertCircle
} from "lucide-react";

interface ProductImageMapperModalProps {
  sales: Order[];
  purchases: Purchase[];
  onClose: () => void;
  onSaved?: () => void;
  initialTab?: "single" | "batch" | "template";
}

export const ProductImageMapperModal: React.FC<ProductImageMapperModalProps> = ({ 
  sales, 
  purchases, 
  onClose,
  onSaved,
  initialTab = "template"
}) => {
  // Config state (mapping of productCode -> url & image)
  const [mediaConfigs, setMediaConfigs] = useState<Record<string, { url: string; image?: string }>>(() => {
    try {
      const saved = localStorage.getItem("khayl_product_media_configs2");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // WhatsApp Message Template state
  const [template, setTemplate] = useState(() => {
    const newDefault = "السلام عليكم {name}، معك فريق الدعم لمتجرنا خيل سطور بخصوص طلبكم لمنتج ({product}). لقد لاحظنا أنه لم يتم تأكيد طلبكم أو واجهتم مشكلة بالتوصيل. هل ما زلت مهتماً بالمنتج لنقوم بمساعدتكم؟\nرابط المنتج للمعاينة: {url}";
    try {
      const stored = localStorage.getItem("khayl_watrans_template");
      if (!stored) {
        return newDefault;
      }
      if (stored === "السلام عليكم {name}، معك فريق الدعم لمتجرنا بخصوص طلبكم لمنتج ({product}). لقد لاحظنا أنه لم يتم تأكيد طلبكم أو واجهتم مشكلة بالتوصيل. هل ما زلت مهتماً بالمنتج لنقوم بمساعدتكم؟\nرابط المنتج للمعاينة: {url}") {
        localStorage.setItem("khayl_watrans_template", newDefault);
        return newDefault;
      }
      return stored;
    } catch {
      return newDefault;
    }
  });

  const [tempTemplate, setTempTemplate] = useState(template);
  const [isTemplateSaved, setIsTemplateSaved] = useState(false);

  // Active Tab inside modal: "single", "batch", or "template"
  const [activeTab, setActiveTab] = useState<"single" | "batch" | "template">(initialTab);

  // Manual configuration selection
  const [selectedProductCode, setSelectedProductCode] = useState("");
  const [productUrlInput, setProductUrlInput] = useState("");
  const [manualSearchQuery, setManualSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Batch import folder files state
  const [batchFiles, setBatchFiles] = useState<Array<{
    id: string;
    fileName: string;
    fileSize: string;
    base64: string;
    detectedCode: string;
    isExactMatch: boolean;
    assignedCode: string; // The selected code for mapping
  }>>([]);
  
  const batchFolderInputRef = useRef<HTMLInputElement>(null);
  const [batchSearchQuery, setBatchSearchQuery] = useState("");
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  // Extract all unique product codes from the sales / purchases
  const uniqueProductCodes = useMemo(() => {
    const codesSet = new Set<string>();
    
    // 1. From Sales
    sales.forEach(sale => {
      const code = sale["Product name"] ? sale["Product name"].trim() : "";
      if (code) codesSet.add(code);
    });

    // 2. From Purchases
    purchases.forEach(p => {
      const code = p.Code ? p.Code.trim() : "";
      if (code) codesSet.add(code);
    });

    return Array.from(codesSet);
  }, [sales, purchases]);

  // Map product code to full product name
  const productCodeToNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    purchases.forEach(p => {
      if (p.Code && p.Produit) {
        map[p.Code.trim().toLowerCase()] = p.Produit.trim();
      }
    });
    return map;
  }, [purchases]);

  const getProductName = (code: string) => {
    if (!code) return "منتج غير معروف";
    const key = code.trim().toLowerCase();
    return productCodeToNameMap[key] || code;
  };

  // Default active code inside manual config on load
  useState(() => {
    if (uniqueProductCodes.length > 0 && !selectedProductCode) {
      const first = uniqueProductCodes[0];
      setSelectedProductCode(first);
      const key = first.trim().toLowerCase();
      setProductUrlInput(mediaConfigs[key]?.url || "");
    }
  });

  // Filtered product code list for Manual Map sidebar
  const filteredManualCodes = useMemo(() => {
    if (!manualSearchQuery.trim()) return uniqueProductCodes;
    const q = manualSearchQuery.toLowerCase();
    return uniqueProductCodes.filter(code => {
      const name = getProductName(code);
      return code.toLowerCase().includes(q) || name.toLowerCase().includes(q);
    });
  }, [uniqueProductCodes, manualSearchQuery, productCodeToNameMap]);

  // Compress images to JPEG with lightweight canvas sizing to avoid localStorage exceeding 5MB limit
  const optimizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 300; // Optimal size for clipboard copy and UI view
          const scale = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scale;

          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            // Compress with lightweight JPEG at 0.75 quality - yields very small strings
            const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
            resolve(dataUrl);
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  // Helper to extract Code from a Filename (e.g. "TSHIRT-02.png" -> "TSHIRT-02")
  const extractCodeFromFilename = (fileName: string): { code: string; isExact: boolean; assigned: string } => {
    // Strip extension
    const baseName = fileName.replace(/\.[^/.]+$/, "").trim();
    const cleanBaseLower = baseName.toLowerCase();

    // 1. Check exact match (case insensitive)
    const exactMatch = uniqueProductCodes.find(
      c => c.trim().toLowerCase() === cleanBaseLower
    );

    if (exactMatch) {
      return { code: exactMatch, isExact: true, assigned: exactMatch };
    }

    // 2. Check slugized / clean exact match (ignoring underscores, hyphens, spaces)
    const slugify = (s: string) => s.replace(/[-_ \t]/g, "").toLowerCase();
    const slugifiedBase = slugify(baseName);

    const fuzzyMatch = uniqueProductCodes.find(
      c => slugify(c) === slugifiedBase
    );

    if (fuzzyMatch) {
      return { code: fuzzyMatch, isExact: true, assigned: fuzzyMatch };
    }

    // 3. Check partial inclusion match
    const containingMatch = uniqueProductCodes.find(
      c => slugifiedBase.includes(slugify(c)) || slugify(c).includes(slugifiedBase)
    );

    if (containingMatch) {
      return { code: containingMatch, isExact: false, assigned: containingMatch };
    }

    // Default: no match found, select empty or first code
    return { 
      code: baseName, 
      isExact: false, 
      assigned: uniqueProductCodes.length > 0 ? uniqueProductCodes[0] : "" 
    };
  };

  // Handle Manual single image selection
  const handleManualImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProductCode) return;

    try {
      const optimizedBase64 = await optimizeImage(file);
      const key = selectedProductCode.trim().toLowerCase();
      
      const updated = {
        ...mediaConfigs,
        [key]: {
          ...mediaConfigs[key],
          image: optimizedBase64
        }
      };

      setMediaConfigs(updated);
      localStorage.setItem("khayl_product_media_configs2", JSON.stringify(updated));
      if (onSaved) onSaved();
    } catch (err) {
      console.error("Manual image optimization failed", err);
    }
  };

  // Delete manual image
  const handleRemoveManualImage = () => {
    if (!selectedProductCode) return;
    const key = selectedProductCode.trim().toLowerCase();
    
    const updated = { ...mediaConfigs };
    if (updated[key]) {
      updated[key] = {
        ...updated[key],
        image: undefined
      };
    }
    
    setMediaConfigs(updated);
    localStorage.setItem("khayl_product_media_configs2", JSON.stringify(updated));
    if (onSaved) onSaved();
  };

  // Save/Change Manual Web Store Link
  const handleSaveManualUrl = (url: string) => {
    if (!selectedProductCode) return;
    const key = selectedProductCode.trim().toLowerCase();
    
    const updated = {
      ...mediaConfigs,
      [key]: {
        ...mediaConfigs[key],
        url: url.trim()
      }
    };

    setMediaConfigs(updated);
    localStorage.setItem("khayl_product_media_configs2", JSON.stringify(updated));
    if (onSaved) onSaved();
  };

  // Parse Folder Batch Uploaded Files
  const handleBatchFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingBatch(true);
    const results: typeof batchFiles = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;

      try {
        const optimized = await optimizeImage(file);
        const { code, isExact, assigned } = extractCodeFromFilename(file.name);
        
        results.push({
          id: `${file.name}-${i}-${Date.now()}`,
          fileName: file.name,
          fileSize: (file.size / 1024).toFixed(1) + " KB",
          base64: optimized,
          detectedCode: code,
          isExactMatch: isExact,
          assignedCode: assigned
        });
      } catch (err) {
        console.warn(`Skipped loading ${file.name}:`, err);
      }
    }

    setBatchFiles(results);
    setIsProcessingBatch(false);
  };

  // Change individual mapping in draft table
  const handleUpdateBatchAssignedCode = (id: string, code: string) => {
    setBatchFiles(prev => prev.map(f => {
      if (f.id === id) {
        return {
          ...f,
          assignedCode: code,
          isExactMatch: code === f.detectedCode || f.fileName.toLowerCase().includes(code.toLowerCase())
        };
      }
      return f;
    }));
  };

  // Apply all batch changes from draft list to actual localStorage
  const handleApplyBatchStorage = () => {
    if (batchFiles.length === 0) return;

    const updated = { ...mediaConfigs };
    batchFiles.forEach(file => {
      if (!file.assignedCode) return;
      const key = file.assignedCode.trim().toLowerCase();
      updated[key] = {
        ...updated[key],
        image: file.base64
      };
    });

    setMediaConfigs(updated);
    localStorage.setItem("khayl_product_media_configs2", JSON.stringify(updated));
    
    // Clear batch draft list and notify success
    setBatchFiles([]);
    if (onSaved) onSaved();
    alert(`🎉 تم معالجة وحفظ عدد ${batchFiles.length} صورة بنجاح وربطها بالأكواد المحددة!`);
    setActiveTab("single"); // Go back to view
  };

  // Filter batch list based on search
  const filteredBatchFiles = useMemo(() => {
    if (!batchSearchQuery.trim()) return batchFiles;
    const q = batchSearchQuery.toLowerCase();
    return batchFiles.filter(f => 
      f.fileName.toLowerCase().includes(q) || 
      f.assignedCode.toLowerCase().includes(q) ||
      getProductName(f.assignedCode).toLowerCase().includes(q)
    );
  }, [batchFiles, batchSearchQuery]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in text-right" dir="rtl">
      <div className="bg-[#0e1628] border border-white/10 rounded-2xl max-w-5xl w-full h-[85vh] overflow-hidden shadow-2xl flex flex-col relative animate-scale-up">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/5 bg-[#111930] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-650/20 text-indigo-400 rounded-xl">
              <FolderSync className="w-5 h-5 text-indigo-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">لوحة ربط أكواد المنتجات بالصور المحلية</h3>
              <p className="text-[11px] text-gray-400">تجاهل روابط الجدول الافتراضية، واربط أكواد المنتجات بصور حقيقية مباشرة من مجلد الكمبيوتر لديك</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector Row */}
        <div className="px-6 bg-[#0c1222] border-b border-white/5 flex gap-4">
          <button
            onClick={() => setActiveTab("template")}
            className={`py-3.5 px-1 text-xs font-bold transition-all relative flex items-center gap-2 ${
              activeTab === "template" ? "text-emerald-400 border-b-2 border-emerald-500" : "text-gray-400 hover:text-white"
            }`}
          >
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span>💬 قالب الرسائل والردود الذكية</span>
          </button>

          <button
            onClick={() => setActiveTab("single")}
            className={`py-3.5 px-1 text-xs font-bold transition-all relative flex items-center gap-2 ${
              activeTab === "single" ? "text-indigo-400 border-b-2 border-indigo-500" : "text-gray-400 hover:text-white"
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>📁 تعيين فردي يدوي</span>
          </button>
          
          <button
            onClick={() => setActiveTab("batch")}
            className={`py-3.5 px-1 text-xs font-bold transition-all relative flex items-center gap-2 ${
              activeTab === "batch" ? "text-indigo-400 border-b-2 border-indigo-500" : "text-gray-400 hover:text-white"
            }`}
          >
            <FolderOpen className="w-4 h-4 text-emerald-400" />
            <span className="flex items-center gap-1.5">
              <span>📂 مطابقة ذكية لمجلد كامل</span>
              <span className="bg-emerald-500/10 text-emerald-400 text-[9px] px-1.5 py-0.5 rounded font-bold">ذكي</span>
            </span>
          </button>
        </div>

        {/* Main Body Column */}
        <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-white/5 overflow-hidden">
          
          {/* ================ TAB 0: TEMPLATE WORKSPACE ================ */}
          {activeTab === "template" && (
            <div className="flex-1 flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-white/5 overflow-y-auto w-full">
              {/* Form Editor Pane */}
              <div className="flex-1 p-6 space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex gap-2 items-center">
                    <MessageSquare className="w-5 h-5 text-emerald-400" />
                    <h4 className="text-sm font-black text-white">تعديل قالب رسالة إعادة الاستهداف</h4>
                  </div>
                  
                  <p className="text-xs text-slate-400 leading-relaxed font-medium">
                    اكتب القالب المناسب لرسالة الواتساب بالأسفل. سيتم استبدال الكلمات المحصورة بين أقواس تلقائياً ببيانات العميل الحالية لتخصيص كل رسالة لكل عميل عند الضغط على زر الإرسال.
                  </p>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-300">نص وهيكل رسالـة الواتساب:</label>
                    <textarea
                      value={tempTemplate}
                      onChange={(e) => {
                        setTempTemplate(e.target.value);
                        setIsTemplateSaved(false);
                      }}
                      className="w-full bg-[#070b14] border border-white/10 rounded-xl p-4 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 min-h-[160px] font-sans leading-relaxed resize-none text-right"
                      placeholder="السلام عليكم {name}..."
                    />
                  </div>

                  {/* Dynamic Helpers Tag Insertion Buttons */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-gray-400 block">انقر لإضافة المتغيّرات للمكان الحالي بالكتابة:</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setTempTemplate(prev => prev + " {name}");
                          setIsTemplateSaved(false);
                        }}
                        className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-[10px] font-mono text-emerald-400 hover:text-emerald-300 transition-colors"
                        title="تلقيم اسم العميل تلقائياً"
                      >
                        {"{name}"} (اسم العميل)
                      </button>
                      <button
                        onClick={() => {
                          setTempTemplate(prev => prev + " {product}");
                          setIsTemplateSaved(false);
                        }}
                        className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-[10px] font-mono text-emerald-400 hover:text-emerald-300 transition-colors"
                        title="تلقيم اسم المنتج المستورد تلقائياً"
                      >
                        {"{product}"} (اسم المنتج)
                      </button>
                      <button
                        onClick={() => {
                          setTempTemplate(prev => prev + " {url}");
                          setIsTemplateSaved(false);
                        }}
                        className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-[10px] font-mono text-emerald-400 hover:text-emerald-300 transition-colors"
                        title="تلقيم رابط صفحة المنتج تلقائياً"
                      >
                        {"{url}"} (رابط المنتج المخصص)
                      </button>
                    </div>
                  </div>

                  {/* Explanatory Info Card */}
                  <div className="bg-emerald-950/20 border border-emerald-500/10 p-4 rounded-xl">
                    <div className="flex gap-2.5 items-start text-[11px] text-emerald-300 leading-relaxed font-medium">
                      <AlertCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white block mb-0.5 text-xs">ملاحظة تقنية مهمة:</strong>
                        تم توجيه النظام لاستخدام <span className="text-white font-bold underline">اسم المنتج المستورد بالكامل</span> بدلاً من رمز المنتج، مما يزيد من جاذبية الرسالة ويجعلها مهنية وواضحة للعملاء بهاتفك.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-4 flex justify-between items-center bg-[#0e1628]">
                  <span className="text-[10px] text-gray-500 font-sans">تم دمج هذه اللوحة بالكامل لتبسيط عملياتك اليومية.</span>
                  <button
                    onClick={() => {
                      setTemplate(tempTemplate);
                      try {
                        localStorage.setItem("khayl_watrans_template", tempTemplate);
                      } catch {}
                      setIsTemplateSaved(true);
                      if (onSaved) onSaved();
                      setTimeout(() => setIsTemplateSaved(false), 2000);
                    }}
                    className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                      isTemplateSaved 
                        ? "bg-emerald-700 text-white shadow-emerald-900/10" 
                        : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20"
                    }`}
                  >
                    {isTemplateSaved ? "✓ تم حفظ التغييرات" : "حفظ صياغة القالب"}
                  </button>
                </div>
              </div>

              {/* Chat Simulation Preview Pane */}
              <div className="w-full lg:w-96 p-6 bg-[#090d16] flex flex-col justify-between shrink-0 border-r lg:border-r border-t lg:border-t-0 border-white/5">
                <div className="space-y-4">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold text-gray-300">محاكاة الرسالة قبل الإرسال (مثال حقيقي):</span>
                  </div>

                  {/* Mobile phone/chat visual display element */}
                  <div className="border border-white/10 rounded-2xl overflow-hidden bg-[#0a0e1a] shadow-inner font-sans">
                    {/* WhatsApp mock header */}
                    <div className="bg-[#0b141a] px-3.5 py-2.5 flex items-center justify-between border-b border-white/5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-white text-xs border border-white/10 uppercase">
                          KH
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-white font-black truncate max-w-[120px]" dir="ltr">
                            {sales[0] ? sales[0]["Customer Name"] || "عميل تجريبي" : "خيل سطور"}
                          </div>
                          <div className="text-[9px] text-[#00e676]">متصل الآن</div>
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono">WhatsApp</span>
                    </div>

                    {/* WhatsApp mock body backgr */}
                    <div className="p-4 bg-[#0d141c] space-y-4 min-h-[220px] relative">
                      {/* Chat Bubbles */}
                      <div className="space-y-1 max-w-[85%] mr-auto text-right">
                        <div className="bg-[#056162] text-white p-3 rounded-2xl rounded-tr-none text-xs leading-relaxed break-words whitespace-pre-wrap">
                          {(() => {
                            const demoCustomer = sales[0] || { "Customer Name": "أحمد عبد الله", "Product name": "K001" };
                            const name = demoCustomer["Customer Name"] || "أحمد عبد الله";
                            const pCode = demoCustomer["Product name"] || "K001";
                            const pKey = pCode.trim().toLowerCase();
                            const pName = getProductName(pCode);
                            const productUrl = mediaConfigs[pKey]?.url || "";

                            // Replaced text simulation
                            let replaced = tempTemplate
                              .replace(/{name}/g, name)
                              .replace(/{product}/g, pName)
                              .replace(/{url}/g, productUrl || `https://khaylstore.com/p/${pCode}`);
                            return replaced;
                          })()}
                        </div>
                        <span className="block text-[8px] text-slate-500 text-left pl-1 font-mono">14:32</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/5 p-3 rounded-xl text-[10px] text-gray-400 font-medium leading-relaxed mt-4">
                  تساعدك هذه المعاينة على موازنة الأسطر والتأكد من وضوح رابط معاينة المنتج للعميل قبل استهدافه الفعلي.
                </div>
              </div>
            </div>
          )}

          {/* ================ TAB 1: SINGLE MANUAL VIEW ================ */}
          {activeTab === "single" && (
            <>
              {/* Left Column: List of System Codes */}
              <div className="w-full md:w-80 flex flex-col bg-[#0b101c] overflow-y-auto shrink-0 p-4">
                <div className="space-y-3 mb-4">
                  <label className="block text-[11px] font-bold text-gray-400">ابحث عن كود منتج بالمتجر:</label>
                  <div className="relative">
                    <span className="absolute right-2.5 top-2.5 text-gray-400">
                      <Search className="w-3.5 h-3.5" />
                    </span>
                    <input 
                      type="text" 
                      placeholder="تصفية الرموز..."
                      value={manualSearchQuery}
                      onChange={(e) => setManualSearchQuery(e.target.value)}
                      className="w-full bg-[#070b14] border border-white/10 rounded-xl pr-9 pl-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder-gray-600"
                    />
                  </div>
                </div>

                <div className="flex-1 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 block mb-2 px-1">رموز المنتجات المستوردة والمسجلة بالسيستم ({filteredManualCodes.length})</span>
                  {filteredManualCodes.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-xs text-slate-400 font-sans">لا توجد رموز مطابقة</div>
                  ) : (
                    filteredManualCodes.map(code => {
                      const key = code.trim().toLowerCase();
                      const hasConf = mediaConfigs[key];
                      const name = getProductName(code);
                      const isSelected = selectedProductCode === code;

                      return (
                        <button
                          key={code}
                          onClick={() => {
                            setSelectedProductCode(code);
                            setProductUrlInput(mediaConfigs[key]?.url || "");
                          }}
                          className={`w-full text-right p-3 rounded-xl text-xs transition-all flex items-center justify-between border ${
                            isSelected 
                              ? "bg-indigo-600/15 border-indigo-500/25 text-white" 
                              : "bg-[#0c1222]/30 border-transparent text-gray-400 hover:text-white hover:bg-[#0c1222]"
                          }`}
                        >
                          <div className="min-w-0 flex-1 pl-2">
                            <div className="font-bold truncate font-sans text-[11px]">{code}</div>
                            <div className="text-[10px] text-gray-500 truncate mt-0.5">{name}</div>
                          </div>
                          
                          {/* Config Indicators */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {hasConf?.image ? (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[8px] font-bold">صورة 🖼️</span>
                            ) : (
                              <span className="text-[8px] text-gray-600 font-sans">فارغ</span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Workspace Side */}
              <div className="flex-1 overflow-y-auto p-6 bg-[#0e1628] flex flex-col justify-between">
                
                {selectedProductCode ? (
                  <div className="space-y-6">
                    
                    {/* Selected Product Banner Header */}
                    <div className="bg-[#111930] p-4 rounded-2xl border border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <span className="text-[10px] bg-indigo-600/20 text-indigo-400 border border-indigo-500/10 px-2.5 py-1 rounded-lg font-mono font-bold">رمز المنتج: {selectedProductCode}</span>
                        <h4 className="text-sm font-bold text-white mt-2">{getProductName(selectedProductCode)}</h4>
                      </div>
                      
                      {/* Count waiting */}
                      <div className="text-left shrink-0">
                        <span className="text-[10px] text-gray-500 font-bold block">مجموع تعثر مكالمات المنتج:</span>
                        <span className="text-xs font-black text-rose-400 font-sans mt-0.5 block">
                          {sales.filter(s => (s["Product name"] || "").trim().toLowerCase() === selectedProductCode.trim().toLowerCase()).length} عميل بانتظار المتابعة
                        </span>
                      </div>
                    </div>

                    {/* Form Item 1: Set URL bypass */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="block text-xs font-bold text-slate-350">رابط مخصص لصفحة المنتج الإلكترونية (مستقل):</label>
                        <span className="text-[9px] text-gray-500">سيتم استبدال الرابط بـ {"{url}"} بالرسائل كبديل للجدول</span>
                      </div>
                      <input
                        type="url"
                        placeholder="على سبيل المثال: https://khaylstore.com/produits/tshirt"
                        value={productUrlInput}
                        onChange={(e) => {
                          setProductUrlInput(e.target.value);
                          handleSaveManualUrl(e.target.value);
                        }}
                        className="w-full bg-[#070b14] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder-gray-600 font-sans"
                      />
                    </div>

                    {/* Form Item 2: Custom Local Image Upload */}
                    <div className="space-y-3">
                      <label className="block text-xs font-bold text-slate-350">الصورة المرتبطة (محملة من الكمبيوتر):</label>
                      
                      {mediaConfigs[selectedProductCode.trim().toLowerCase()]?.image ? (
                        <div className="border border-indigo-500/15 bg-indigo-950/15 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
                          
                          {/* Image Thumbnail */}
                          <div className="w-28 h-28 rounded-xl overflow-hidden border border-white/10 bg-[#0d1426] flex items-center justify-center relative shadow-md shrink-0">
                            <img 
                              src={mediaConfigs[selectedProductCode.trim().toLowerCase()]?.image} 
                              alt="معاينة" 
                              className="w-full h-full object-cover" 
                            />
                          </div>

                          <div className="flex-1 space-y-2 text-center sm:text-right">
                            <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              <h5 className="text-xs font-bold text-white">الصورة محفوظة مشفرة محلياً!</h5>
                            </div>
                            <p className="text-[10px] text-gray-400 leading-relaxed max-w-sm">
                              تم تخزين هذه الصورة بذاكرة اللوحة بجودة عالية وحجم خفيف. سيقوم النظام باستخدامها فوراً بدلاً من الروابط الموجودة بالجدول.
                            </p>
                            
                            <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-1">
                              {/* Change button */}
                              <label className="cursor-pointer h-7 px-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 transition-colors">
                                <Upload className="w-3.5 h-3.5" />
                                <span>تغيير الصورة</span>
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  onChange={handleManualImageUpload} 
                                />
                              </label>

                              {/* Delete button */}
                              <button
                                onClick={handleRemoveManualImage}
                                className="h-7 px-2.5 bg-rose-950/20 hover:bg-rose-900/40 text-rose-400 border border-rose-500/10 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>إزالة الربط والصورة</span>
                              </button>
                            </div>
                          </div>

                        </div>
                      ) : (
                        // No image uploaded, show drag drop zone
                        <div 
                          className="border-2 border-dashed border-white/10 hover:border-indigo-500/40 bg-[#070b14] rounded-2xl p-8 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <div className="w-12 h-12 bg-white/5 text-gray-400 rounded-full flex items-center justify-center">
                            <Upload className="w-6 h-6 text-indigo-400 animate-bounce" />
                          </div>
                          <div className="text-center">
                            <span className="text-xs font-bold text-white block mb-0.5">انقر هنا لتصفح واختيار صورة هذا المنتج من الكمبيوتر</span>
                            <span className="text-[10px] text-gray-500 block">يقبل جميع أنواع امتدادات الصور. سيتم تخزينها في الذاكرة المحلية تلقائياً.</span>
                          </div>
                          
                          <input 
                            type="file" 
                            ref={fileInputRef}
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleManualImageUpload} 
                          />
                        </div>
                      )}

                    </div>

                    {/* Visual tutorial note */}
                    <div className="bg-[#111930] border border-white/5 p-4 rounded-xl space-y-2">
                      <div className="flex gap-2 items-center text-xs font-bold text-white">
                        <HelpCircle className="w-4 h-4 text-emerald-400" />
                        <span>مبدأ العمل في اللوحة:</span>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-relaxed">
                        عندما تقوم بتعيين صور المنتجات محلياً هنا، فإن أي عمل جماعي أو مراسلة للعميل عبر الواتساب ستعتمد على هذه الصور. يمكنك نسخ أي صورة فوراً ولصقها مجاناً في محادثة عميلك ليدرك جودة منتجك الملموس.
                      </p>
                    </div>

                  </div>
                ) : (
                  <div className="text-center py-20 flex flex-col items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-gray-600 mb-2" />
                    <h4 className="text-sm font-bold text-gray-400">يرجى اختيار رمز منتج من القائمة الجانبية لتخصيص صورته</h4>
                  </div>
                )}

                {/* Footer closed */}
                <div className="border-t border-white/5 pt-4 mt-6 flex justify-end">
                  <button
                    onClick={onClose}
                    className="px-6 py-2 bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-950/20"
                  >
                    حفظ وإغلاق لوحة التحكم
                  </button>
                </div>

              </div>
            </>
          )}

          {/* ================ TAB 2: SMART BATCH FOLDER MAPPER ================ */}
          {activeTab === "batch" && (
            <div className="flex-1 flex flex-col p-6 bg-[#0e1628] overflow-y-auto">
              
              {/* If no files have been drag-dropped yet */}
              {batchFiles.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 space-y-6">
                  
                  {/* Folder Drop Zone representation */}
                  <div 
                    className="border-2 border-dashed border-emerald-500/20 hover:border-emerald-500/50 bg-[#070b14] rounded-2xl p-12 max-w-xl w-full flex flex-col items-center justify-center gap-4 transition-all cursor-pointer text-center"
                    onClick={() => batchFolderInputRef.current?.click()}
                  >
                    <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center">
                      <FolderOpen className="w-8 h-8 text-emerald-400 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">اختر أو اسحب مجلد صور منتجاتك من جهازك</h4>
                      <p className="text-xs text-gray-400 mt-2 max-w-sm leading-relaxed">
                        يمكنك اختيار **عدة صور معاً** من جهاز الكمبيوتر. سيقوم الذكاء بقرائة أسماء الملفات ومطابقتها تلقائياً مع أكواد مبيعاتك!
                      </p>
                    </div>
                    
                    <button className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors mt-2">
                      📁 تحديد وتصفح ملفات من المجلد
                    </button>

                    {/* Hidden Multiple File Input */}
                    <input 
                      type="file" 
                      ref={batchFolderInputRef}
                      accept="image/*" 
                      multiple
                      className="hidden" 
                      onChange={handleBatchFolderUpload} 
                    />
                  </div>

                  {/* Informational Help Grid */}
                  <div className="max-w-xl w-full grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="bg-[#111930] p-4 rounded-xl border border-white/5 space-y-1">
                      <div className="font-bold text-white flex items-center gap-1 text-[11px]">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>مطابقة تلقائية بالاسم</span>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-relaxed">
                        إذا قمت بتسمية الصورة باسم الكود (مثل <strong className="text-white">PROD-102.jpg</strong>) سيتم ربطه بـ <strong className="text-white">PROD-102</strong> فوراً وبدون أي تدخل!
                      </p>
                    </div>

                    <div className="bg-[#111930] p-4 rounded-xl border border-white/5 space-y-1">
                      <div className="font-bold text-white flex items-center gap-1 text-[11px]">
                        <ArrowLeftRight className="w-4 h-4 text-indigo-400" />
                        <span>خيار الاختيار اليدوي السريع</span>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-relaxed">
                        إذا لم يتطابق الاسم تماماً، سيعرض لك اللمحة السريعة اختيار الكود المناسب من قائمة منسدلة جانب المعاينة لتعديلها فوراً وبسهولة.
                      </p>
                    </div>
                  </div>

                </div>
              ) : (
                /* Files are loaded, show interactive review table */
                <div className="flex-1 flex flex-col space-y-4">
                  
                  {/* Status indicator bar */}
                  <div className="bg-[#111930] p-4 rounded-2xl border border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-emerald-500/10 p-2 text-emerald-400 rounded-lg">
                        <Check className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">قائمة الصور المستوردة والمكتشفة من المجلد</h4>
                        <p className="text-[10px] text-gray-405">عدد الصور المكتملة للتخزين: <span className="font-mono font-bold text-emerald-400">{batchFiles.length} صور</span>. يرجى مراجعة تطابق كود كل منتج بالأسفل قبل التنفيذ.</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {/* Upload more images */}
                      <button 
                        onClick={() => batchFolderInputRef.current?.click()}
                        className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة المزيد من المجلد</span>
                      </button>

                      {/* Apply and Save all mapped files */}
                      <button
                        onClick={handleApplyBatchStorage}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-emerald-900/15"
                      >
                        <FolderSync className="w-4 h-4 text-white" />
                        <span>💾 حفظ كافة صور المجلد بالسيستم</span>
                      </button>
                    </div>
                  </div>

                  {/* Filter / Search draft list */}
                  <div className="relative">
                    <span className="absolute right-3 top-2.5 text-gray-400">
                      <Search className="w-4 h-4" />
                    </span>
                    <input 
                      type="text" 
                      placeholder="البحث ضمن مسودة الصور باسم الملف، كود المعين..."
                      value={batchSearchQuery}
                      onChange={(e) => setBatchSearchQuery(e.target.value)}
                      className="w-full bg-[#0d1426] border border-white/10 rounded-xl pr-9 pl-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* The interactive Preview table */}
                  <div className="flex-1 overflow-y-auto border border-white/5 rounded-2xl bg-[#080d19]/40 max-h-[45vh]">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead>
                        <tr className="bg-white/[0.03] border-b border-white/5 text-gray-400 font-bold text-[10px]">
                          <th className="px-4 py-3">المعاينة</th>
                          <th className="px-4 py-3">اسم الملف بالكمبيوتر</th>
                          <th className="px-4 py-3">الحجم المحسن</th>
                          <th className="px-4 py-3">الكود المكتشف بالاسم</th>
                          <th className="px-4 py-3">توجيه وربط إلى (تغيير كود الـ Google Sheet)</th>
                          <th className="px-4 py-3">اسم المنتج الفعلي</th>
                          <th className="px-4 py-3 text-center">الإجراء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredBatchFiles.map(file => {
                          return (
                            <tr key={file.id} className="hover:bg-white/[0.01] transition-all">
                              
                              {/* Preview Thumbnail */}
                              <td className="px-4 py-3">
                                <div className="w-10 h-10 rounded overflow-hidden border border-white/10 shrink-0 bg-black flex items-center justify-center">
                                  <img src={file.base64} alt={file.fileName} className="w-full h-full object-cover" />
                                </div>
                              </td>

                              {/* Target filename */}
                              <td className="px-4 py-3 font-mono text-[11px] text-gray-300">
                                {file.fileName}
                              </td>

                              {/* Optimized compressed weight */}
                              <td className="px-4 py-3 text-slate-500 font-mono text-[10px]">
                                {file.fileSize}
                              </td>

                              {/* Detected code slug */}
                              <td className="px-4 py-3 font-bold">
                                <span className="bg-white/5 px-2 py-0.5 rounded text-gray-400 border border-white/5">
                                  {file.detectedCode}
                                </span>
                              </td>

                              {/* Selection Dropdown to manually override linkage */}
                              <td className="px-4 py-3 text-emerald-450">
                                <div className="flex items-center gap-2">
                                  <select 
                                    value={file.assignedCode}
                                    onChange={(e) => handleUpdateBatchAssignedCode(file.id, e.target.value)}
                                    className="bg-[#070b14] border border-white/10 text-[11px] rounded px-2 py-1 text-white focus:outline-none focus:border-indigo-500 max-w-[160px]"
                                  >
                                    <option value="">-- اختر كود منتج --</option>
                                    {uniqueProductCodes.map(code => (
                                      <option key={code} value={code}>
                                        {code} ({getProductName(code).slice(0, 15)}...)
                                      </option>
                                    ))}
                                  </select>

                                  {/* Badge exact matching */}
                                  {file.isExactMatch ? (
                                    <span className="bg-emerald-500/10 text-emerald-400 text-[8px] font-bold px-1.5 py-0.5 rounded">
                                      طابقت!
                                    </span>
                                  ) : (
                                    <span className="bg-amber-500/10 text-amber-400 text-[8px] font-bold px-1.5 py-0.5 rounded" title="لم يتطابق اسم الملف يدوياً مع أي كود، يرجى التعيين يدوياً من القائمة">
                                      تحقق ⚠️
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Actual System Product Name */}
                              <td className="px-4 py-3 max-w-[150px] truncate font-bold text-sky-450 font-sans" title={getProductName(file.assignedCode)}>
                                {getProductName(file.assignedCode)}
                              </td>

                              {/* Actions - remove from draft */}
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => setBatchFiles(prev => prev.filter(f => f.id !== file.id))}
                                  className="text-[10px] text-rose-400 hover:text-rose-355 underline"
                                >
                                  استبعاد
                                </button>
                              </td>

                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary of what will happen */}
                  <div className="bg-emerald-950/15 border border-emerald-500/10 p-4 rounded-xl text-[11px] leading-relaxed text-emerald-400">
                    <strong className="text-white">💡 انتباه:</strong> عند النقر على "حفظ كافة صور المجلد بالسيستم" في الأعلى، سيقوم النظام تلقائياً بربط الصور الجديدة بكافة أكواد المنتجات النشطة بالمتجر وإتاحتها فوراً لجميع العملاء، مما يوفر عليك الوقت والجهد وتعيين كود كود بشكل منفرد!
                  </div>

                </div>
              )}

              {/* Footer closed */}
              <div className="border-t border-white/5 pt-4 mt-6 flex justify-between items-center bg-[#0e1628]">
                <span className="text-[10px] text-gray-500">ملاحظة: يدعم تصفح المجلدات الفرعية وسحب وتحديد عدد غير محدود من العناصر والصور.</span>
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-950/20"
                >
                  إغلاق وتخطي
                </button>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};

import React from "react";
import { AlertTriangle, Trash2, Edit2, ShieldAlert } from "lucide-react";

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning" | "info";
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = "تأكيد الإجراء",
  cancelText = "تراجع وإلغاء",
  type = "warning",
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" dir="rtl">
      <div 
        id="custom-confirmation-dialog" 
        className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden text-right transform transition-all p-6 space-y-4"
      >
        <div className="flex gap-4 items-start">
          <div className={`p-3 rounded-xl shrink-0 ${
            type === "danger" 
              ? "bg-rose-500/15 text-rose-400 border border-rose-500/20" 
              : type === "warning"
              ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
              : "bg-blue-500/15 text-blue-400 border border-blue-500/20"
          }`}>
            {type === "danger" ? (
              <Trash2 className="w-6 h-6 animate-pulse" />
            ) : type === "warning" ? (
              <AlertTriangle className="w-6 h-6" />
            ) : (
              <ShieldAlert className="w-6 h-6" />
            )}
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white leading-tight">{title}</h3>
            <p className="text-xs text-gray-400 leading-relaxed font-sans">{message}</p>
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-semibold transition-all"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5 ${
              type === "danger"
                ? "bg-red-600 hover:bg-red-500 shadow-lg shadow-red-950/30"
                : type === "warning"
                ? "bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-950/30"
                : "bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-950/30"
            }`}
          >
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

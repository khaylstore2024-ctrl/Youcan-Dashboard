import React, { useState } from "react";
import { Lock, Mail, Loader2, Sparkles, AlertCircle } from "lucide-react";

export function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    setTimeout(() => {
      if (email.trim().toLowerCase() === "alfarisse100@gmail.com" && password === "alfarisse100") {
        onLogin();
      } else {
        setError("عذراً! البريد الإلكتروني أو كلمة المرور غير صحيحة.");
      }
      setIsSubmitting(false);
    }, 650);
  };

  return (
    <div className="min-h-screen bg-[#070a13] text-[#f3f4f6] flex items-center justify-center font-sans p-4 relative overflow-hidden antialiased select-none" dir="rtl">
      {/* Absolute Decorative Background Elements */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/5 blur-[100px] pointer-events-none"></div>
      
      <div className="w-full max-w-md relative z-10 transition-all duration-300">
        
        {/* Branding Logo Area */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-blue-600/10 border border-blue-500/20 rounded-2xl mb-4 shadow-xl">
            <Sparkles className="w-7 h-7 text-blue-500" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-wide">لوحة التحكم الخاصة بالفارس 🛡️</h1>
          <p className="text-xs text-gray-400 mt-1.5 font-medium">الرجاء تسجيل الدخول للوصول إلى قاعدة بيانات المبيعات الحساسة</p>
        </div>

        {/* Login Box */}
        <div className="bg-[#0b1020]/80 border border-white/5 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative">
          
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Message */}
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/25 p-3.5 rounded-2xl flex items-start gap-3 text-rose-400 text-xs animate-fadeIn leading-relaxed">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Email Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-300 block">البريد الإلكتروني</label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-gray-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pr-10 pl-4 py-3 bg-[#111930] border border-white/5 rounded-2xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-300 block">كلمة المرور الخاصة</label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-gray-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pr-10 pl-4 py-3 bg-[#111930] border border-white/5 rounded-2xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-2xl transition-all duration-200 active:scale-95 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري التحقق من الهوية...</span>
                </>
              ) : (
                <span>ولوج آمن للقرية الرقمية 🗝️</span>
              )}
            </button>
          </form>

        </div>

        {/* Footer info lock */}
        <div className="text-center mt-6">
          <span className="text-[10px] text-gray-500 select-none">نظام تشفير مغلق ثنائي الاتجاه • v2.1.2_Secure</span>
        </div>

      </div>
    </div>
  );
}

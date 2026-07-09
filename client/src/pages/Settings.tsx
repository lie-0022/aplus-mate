import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { Switch } from "@/components/ui/switch";
import {
  Moon,
  BookOpen,
  Mail,
  Shield,
  FileText,
  LogOut,
  UserCircle,
  Presentation,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";

const SUPPORT_EMAIL = "jayjun.rim@gmail.com";
const APP_VERSION = "2026.1 · 1차 코호트 베타";

// 흩어져 있던 문의·약관·테마·계정 항목을 한곳에 모은 설정 화면.
export default function Settings() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const linkRow = (
    icon: React.ComponentType<{ className?: string }>,
    label: string,
    onClick: () => void,
    opts?: { danger?: boolean; sub?: string }
  ) => {
    const Icon = icon;
    return (
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted ${
          opts?.danger ? "text-destructive" : "text-foreground"
        }`}
      >
        <Icon className={`h-[18px] w-[18px] shrink-0 ${opts?.danger ? "" : "text-muted-foreground"}`} />
        <span className="flex-1 text-[15px] font-medium">{label}</span>
        {opts?.sub && <span className="text-[13px] text-muted-foreground">{opts.sub}</span>}
        {!opts?.danger && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
    );
  };

  const sectionLabel = (t: string) => (
    <div className="px-1 pb-1.5 pt-1 text-[12px] font-bold text-muted-foreground">{t}</div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => (window.history.length > 1 ? window.history.back() : setLocation("/dashboard"))}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> 뒤로
      </button>
      <h1 className="text-2xl font-extrabold mb-5">설정</h1>

      {/* 화면 */}
      {sectionLabel("화면")}
      <div className="rounded-[18px] bg-card shadow-card overflow-hidden mb-5">
        <div className="w-full flex items-center gap-3 px-4 py-3.5">
          <Moon className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
          <span className="flex-1 text-[15px] font-medium">다크 모드</span>
          <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
        </div>
      </div>

      {/* 도움말 */}
      {sectionLabel("도움말")}
      <div className="rounded-[18px] bg-card shadow-card overflow-hidden mb-5 divide-y divide-border">
        {linkRow(BookOpen, "A+ Mate 사용법", () => setLocation("/guide"))}
        {linkRow(Mail, "문의·지원", () => (window.location.href = `mailto:${SUPPORT_EMAIL}`), {
          sub: "이메일",
        })}
      </div>

      {/* 약관 */}
      {sectionLabel("약관·정책")}
      <div className="rounded-[18px] bg-card shadow-card overflow-hidden mb-5 divide-y divide-border">
        {linkRow(Shield, "개인정보처리방침", () => setLocation("/privacy"))}
        {linkRow(FileText, "이용약관", () => setLocation("/terms"))}
      </div>

      {/* 계정 */}
      {sectionLabel("계정")}
      <div className="rounded-[18px] bg-card shadow-card overflow-hidden mb-5 divide-y divide-border">
        {linkRow(UserCircle, "내 프로필", () => setLocation("/profile"))}
        {(user?.role === "professor" || user?.role === "admin") &&
          linkRow(Presentation, "교수 페이지", () => setLocation("/professor"))}
        {user?.role === "admin" &&
          linkRow(ShieldCheck, "운영자 페이지", () => setLocation("/admin"))}
        {linkRow(LogOut, "로그아웃", () => logout(), { danger: true })}
      </div>

      <p className="text-center text-[12px] text-muted-foreground mt-6">
        A+ Mate · {APP_VERSION}
      </p>
    </div>
  );
}

import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  Home,
  LogOut,
  Users,
  UserCircle,
  Bell,
  Handshake,
  Presentation,
  ShieldCheck,
  Settings as SettingsIcon,
  CalendarDays,
} from "lucide-react";
import { useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { icon: Home, label: "홈", path: "/dashboard" },
  { icon: BookOpen, label: "수업", path: "/courses" },
  { icon: CalendarDays, label: "시간표", path: "/timetable" },
  { icon: Handshake, label: "매칭", path: "/matching/requests" },
  { icon: Users, label: "팀", path: "/teams" },
  { icon: UserCircle, label: "프로필", path: "/profile" },
];

function AppLayoutSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b px-4 h-14 flex items-center justify-between">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <main className="pb-20 px-4 py-4">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-32 w-full rounded-xl mb-3" />
        <Skeleton className="h-32 w-full rounded-xl mb-3" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </main>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { theme } = useTheme();
  const [location, setLocation] = useLocation();

  // Pending match requests count
  const pendingQuery = trpc.matching.pendingCount.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 30000,
  });

  // 인앱 알림센터
  const utils = trpc.useUtils();
  const notifications = trpc.notifications.list.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 30000,
  });
  const unreadQuery = trpc.notifications.unreadCount.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 30000,
  });
  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  if (loading) return <AppLayoutSkeleton />;

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-6 max-w-sm w-full text-center">
          <img
            src={theme === "dark" ? "/logo-dark.png" : "/logo-light.png"}
            alt="A+ Mate"
            className="h-10 w-auto"
          />
          <p className="text-muted-foreground text-sm -mt-2">
            대학생 팀플 팀원 매칭 플랫폼
          </p>
          <Button
            onClick={() => (window.location.href = getLoginUrl())}
            size="lg"
            className="w-full gradient-primary text-white border-0"
          >
            로그인하기
          </Button>
        </div>
      </div>
    );
  }

  const pendingCount = pendingQuery.data?.count ?? 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b">
        <div className="h-14 px-4 flex items-center justify-between">
          <button
            onClick={() => setLocation("/dashboard")}
            className="flex items-center gap-2"
          >
            <img
              src={theme === "dark" ? "/logo-dark.png" : "/logo-light.png"}
              alt="A+ Mate"
              className="h-6 w-auto"
            />
          </button>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative p-2 hover:bg-muted rounded-lg transition-colors">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  {(unreadQuery.data?.count ?? 0) > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-destructive text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {(unreadQuery.data?.count ?? 0) > 9 ? "9+" : unreadQuery.data?.count}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-sm font-semibold">알림</span>
                  {(unreadQuery.data?.count ?? 0) > 0 && (
                    <button
                      onClick={() => markAllRead.mutate()}
                      className="text-xs text-primary hover:underline"
                    >
                      모두 읽음
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {!notifications.data || notifications.data.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">알림이 없어요</p>
                  ) : (
                    notifications.data.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => {
                          if (!n.isRead) markRead.mutate({ notificationId: n.id });
                          if (n.linkPath) setLocation(n.linkPath);
                        }}
                        className={`w-full text-left px-2 py-2 hover:bg-muted rounded-md ${
                          !n.isRead ? "bg-primary/5" : ""
                        }`}
                      >
                        <div className="text-sm font-medium flex items-center gap-1.5">
                          {!n.isRead && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                          )}
                          <span className="truncate">{n.title}</span>
                        </div>
                        {n.body && (
                          <div className="text-xs text-muted-foreground truncate pl-3">
                            {n.body}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-0.5 pl-3">
                          {new Date(n.createdAt).toLocaleString("ko-KR", {
                            month: "numeric",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 p-1 hover:bg-muted rounded-lg transition-colors">
                  <Avatar className="h-8 w-8 border">
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                      {user.name?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => setLocation("/profile")}
                  className="cursor-pointer"
                >
                  <UserCircle className="mr-2 h-4 w-4" />
                  내 프로필
                </DropdownMenuItem>
                {(user.role === "professor" || user.role === "admin") && (
                  <DropdownMenuItem
                    onClick={() => setLocation("/professor")}
                    className="cursor-pointer"
                  >
                    <Presentation className="mr-2 h-4 w-4" />
                    교수 페이지
                  </DropdownMenuItem>
                )}
                {user.role === "admin" && (
                  <DropdownMenuItem
                    onClick={() => setLocation("/admin")}
                    className="cursor-pointer"
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    운영자 페이지
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => setLocation("/settings")}
                  className="cursor-pointer"
                >
                  <SettingsIcon className="mr-2 h-4 w-4" />
                  설정
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  로그아웃
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-20 py-4 lg:ml-60 overflow-auto">
        <div className="container">{children}</div>
      </main>

      {/* Bottom navigation (mobile-first) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur border-t lg:hidden" style={{height: '64px'}}>
        <div className="flex items-center justify-around h-full px-2">
          {navItems.map((item) => {
            const isActive =
              location === item.path ||
              (item.path !== "/dashboard" && location.startsWith(item.path));
            return (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors relative ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
                {item.path === "/matching/requests" && pendingCount > 0 && (
                  <span className="absolute -top-0.5 right-0 bg-destructive text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {pendingCount > 9 ? "9+" : pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Desktop side nav (lg+) */}
      <nav className="hidden lg:flex fixed left-0 top-14 bottom-0 w-60 border-r bg-background/95 flex-col p-4 gap-1 z-40 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            location === item.path ||
            (item.path !== "/dashboard" && location.startsWith(item.path));
          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium relative ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
              {item.path === "/matching/requests" && pendingCount > 0 && (
                <span className="ml-auto bg-destructive text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import ProfileSetup from "./pages/ProfileSetup";
import Profile from "./pages/Profile";
import Courses from "./pages/Courses";
import CourseDetail from "./pages/CourseDetail";
import MatchingRequests from "./pages/MatchingRequests";
import Teams from "./pages/Teams";
import TeamDetail from "./pages/TeamDetail";
import TeamEvaluate from "./pages/TeamEvaluate";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import AppLayout from "./components/AppLayout";
import { useAuth } from "./_core/hooks/useAuth";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { saveReturnTo, consumeReturnTo } from "./lib/returnTo";

function ProtectedPage({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      // 로그아웃 상태로 보호 페이지(예: /courses/:id 딥링크)에 진입한 경우,
      // 로그인 후 돌아올 경로를 저장한다. OAuth 콜백은 무조건 '/'로 착지하므로
      // 반드시 setLocation("/") 직전인 이 지점에서 캡처해야 경로가 보존된다.
      // (제외 경로·만료 처리는 saveReturnTo가 담당.)
      saveReturnTo(window.location.pathname + window.location.search);
      setLocation("/");
    }
  }, [user, loading, setLocation]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function Router() {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();

  // Redirect authenticated users away from home page
  useEffect(() => {
    if (!loading && user && location === "/") {
      // 프로필 미완성이면 먼저 설정 화면으로. returnTo는 소비하지 않고 보존해
      // 설정 완료 후 ProfileSetup에서 원래 딥링크로 복원되게 한다.
      if (!user.profileCompleted) {
        setLocation("/profile/setup");
        return;
      }
      // 프로필 완성(가장 흔한 복귀 케이스): 저장된 딥링크가 있으면 복원·소비, 없으면 대시보드.
      // consumeReturnTo가 만료·제외 경로를 걸러 stale 납치를 방지한다.
      const returnTo = consumeReturnTo();
      setLocation(returnTo ?? "/dashboard");
    }
  }, [user, loading, location, setLocation]);

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/profile/setup">
        <ProtectedPage component={ProfileSetup} />
      </Route>
      <Route path="/dashboard">
        <ProtectedPage component={Dashboard} />
      </Route>
      <Route path="/profile">
        <ProtectedPage component={Profile} />
      </Route>
      <Route path="/courses">
        <ProtectedPage component={Courses} />
      </Route>
      <Route path="/courses/:id">
        <ProtectedPage component={CourseDetail} />
      </Route>
      <Route path="/matching/requests">
        <ProtectedPage component={MatchingRequests} />
      </Route>
      <Route path="/teams">
        <ProtectedPage component={Teams} />
      </Route>
      <Route path="/teams/:id">
        <ProtectedPage component={TeamDetail} />
      </Route>
      <Route path="/teams/:id/evaluate">
        <ProtectedPage component={TeamEvaluate} />
      </Route>
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

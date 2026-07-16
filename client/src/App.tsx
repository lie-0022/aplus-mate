import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AppLayout from "./components/AppLayout";
// 랜딩(Home)은 로그아웃 유저의 첫 페인트(에타·카톡 링크 착지)라 eager로 즉시 렌더.
import Home from "./pages/Home";
import { lazy, Suspense, useEffect } from "react";
import { useAuth } from "./_core/hooks/useAuth";
import { useLocation } from "wouter";
import { saveReturnTo, consumeReturnTo } from "./lib/returnTo";

// 나머지 화면은 라우트 단위로 코드 스플리팅 — 초기 번들에서 recharts·카드·카메라 등
// 무거운 의존성을 떼어내 첫 로드(특히 모바일·무료 호스팅 콜드스타트)를 가볍게 한다.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ProfileSetup = lazy(() => import("./pages/ProfileSetup"));
const Profile = lazy(() => import("./pages/Profile"));
const Courses = lazy(() => import("./pages/Courses"));
const CourseDetail = lazy(() => import("./pages/CourseDetail"));
const Timetable = lazy(() => import("./pages/Timetable"));
const Planner = lazy(() => import("./pages/Planner"));
const TimetableBoard = lazy(() => import("./pages/TimetableBoard"));
const PostDetail = lazy(() => import("./pages/PostDetail"));
const Admin = lazy(() => import("./pages/Admin"));
const Professor = lazy(() => import("./pages/Professor"));
const SurveyAnswer = lazy(() => import("./pages/SurveyAnswer"));
const MatchingRequests = lazy(() => import("./pages/MatchingRequests"));
const Teams = lazy(() => import("./pages/Teams"));
const TeamDetail = lazy(() => import("./pages/TeamDetail"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const TeamEvaluate = lazy(() => import("./pages/TeamEvaluate"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Settings = lazy(() => import("./pages/Settings"));
const Guide = lazy(() => import("./pages/Guide"));
const NotFound = lazy(() => import("./pages/NotFound"));

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground text-sm">불러오는 중…</div>
    </div>
  );
}

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
    // 하나의 Suspense 경계 — 어떤 lazy 라우트든 청크 로드 동안 폴백을 보여준다.
    <Suspense fallback={<RouteFallback />}>
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
        <Route path="/timetable">
          <ProtectedPage component={Timetable} />
        </Route>
        <Route path="/planner">
          <ProtectedPage component={Planner} />
        </Route>
        <Route path="/timetables">
          <ProtectedPage component={TimetableBoard} />
        </Route>
        <Route path="/timetables/:id">
          <ProtectedPage component={TimetableBoard} />
        </Route>
        <Route path="/posts/:id">
          <ProtectedPage component={PostDetail} />
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
        <Route path="/admin">
          <ProtectedPage component={Admin} />
        </Route>
        <Route path="/professor">
          <ProtectedPage component={Professor} />
        </Route>
        <Route path="/users/:id">
          <ProtectedPage component={PublicProfile} />
        </Route>
        <Route path="/surveys/:id">
          <ProtectedPage component={SurveyAnswer} />
        </Route>
        <Route path="/settings">
          <ProtectedPage component={Settings} />
        </Route>
        <Route path="/guide">
          <ProtectedPage component={Guide} />
        </Route>
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

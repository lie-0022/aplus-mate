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
import AppLayout from "./components/AppLayout";
import { useAuth } from "./_core/hooks/useAuth";
import { useEffect } from "react";
import { useLocation } from "wouter";

function ProtectedPage({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
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
      if (!user.profileCompleted) {
        setLocation("/profile/setup");
      } else {
        setLocation("/dashboard");
      }
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

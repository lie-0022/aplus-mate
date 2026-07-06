import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="w-full max-w-lg mx-4 rounded-2xl bg-card shadow-card p-10 text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full badge-danger flex items-center justify-center">
            <AlertCircle className="h-9 w-9" />
          </div>
        </div>

        <h1 className="text-4xl font-extrabold mb-2">404</h1>
        <h2 className="text-lg font-bold text-muted-foreground mb-4">페이지를 찾을 수 없어요</h2>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
          주소가 바뀌었거나 삭제된 페이지예요.
        </p>

        <Button onClick={() => setLocation("/")}>
          <Home className="w-4 h-4 mr-2" /> 홈으로 가기
        </Button>
      </div>
    </div>
  );
}

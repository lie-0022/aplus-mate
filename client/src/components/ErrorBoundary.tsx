import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-md p-8 text-center">
            <AlertTriangle size={48} className="text-destructive mb-6 flex-shrink-0" />

            <h2 className="text-xl font-bold mb-2">예기치 못한 오류가 발생했어요</h2>
            <p className="text-sm text-muted-foreground mb-6">
              잠시 후 다시 시도해 주세요. 문제가 계속되면 아래로 문의해 주세요.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "bg-primary text-primary-foreground",
                  "hover:opacity-90 cursor-pointer"
                )}
              >
                <RotateCcw size={16} />
                새로고침
              </button>
              <button
                onClick={() => (window.location.href = "/dashboard")}
                className={cn(
                  "px-4 py-2 rounded-lg border",
                  "hover:bg-muted cursor-pointer"
                )}
              >
                홈으로
              </button>
            </div>

            <a
              href="mailto:jayjun.rim@gmail.com"
              className="text-xs text-muted-foreground underline mt-4"
            >
              문의: jayjun.rim@gmail.com
            </a>

            {/* 스택은 개발 모드에서만 — 실사용자에게 내부 정보 노출 방지 */}
            {import.meta.env.DEV && this.state.error?.stack && (
              <pre className="text-[10px] text-muted-foreground/60 mt-6 max-w-full overflow-auto text-left whitespace-break-spaces">
                {this.state.error.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import {
  GraduationCap,
  Users,
  Shield,
  Star,
  ArrowRight,
  CheckCircle2,
  MessageCircle,
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-primary opacity-5" />
        <div className="container py-16 md:py-24 relative">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Star className="h-4 w-4" />
              대학생 팀플 매칭 플랫폼
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-tight">
              팀플, 이제{" "}
              <span className="text-transparent bg-clip-text gradient-primary inline-block">
                A+ Mate
              </span>
              로
              <br />
              믿을 수 있는 팀원 찾기
            </h1>
            <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
              블라인드 평가로 쌓이는 신뢰 배지 시스템.
              <br />
              검증된 팀원과 함께 A+를 향해 나아가세요.
            </p>
            <Button
              size="lg"
              onClick={() => (window.location.href = getLoginUrl())}
              className="gradient-primary text-white border-0 text-base px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all"
            >
              시작하기
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container py-16">
        <h2 className="text-2xl font-bold text-center mb-12">
          왜 A+ Mate인가요?
        </h2>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            {
              icon: Users,
              title: "스마트 팀원 매칭",
              desc: "같은 수업을 듣는 학생들 중에서 배지와 스킬태그를 기반으로 최적의 팀원을 찾아보세요.",
              color: "bg-primary/10 text-primary",
            },
            {
              icon: Shield,
              title: "블라인드 평가 시스템",
              desc: "팀플 종료 후 익명으로 팀원을 평가하고, 누적 평가로 신뢰 배지를 획득하세요.",
              color: "bg-sky-brand/10 text-sky-brand",
            },
            {
              icon: MessageCircle,
              title: "안전한 연락처 공개",
              desc: "매칭이 수락된 후에만 카카오 오픈채팅 링크가 공개되어 안전하게 소통할 수 있어요.",
              color: "bg-primary/10 text-primary",
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="bg-card rounded-2xl p-6 border shadow-sm hover:shadow-md transition-shadow"
            >
              <div
                className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-4`}
              >
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="gradient-primary-soft py-16">
        <div className="container">
          <h2 className="text-2xl font-bold text-center mb-12">
            이렇게 사용해요
          </h2>
          <div className="max-w-3xl mx-auto space-y-4">
            {[
              "프로필을 설정하고 수업을 등록하세요",
              "같은 수업을 듣는 팀원에게 커넥트 요청을 보내세요",
              "매칭이 수락되면 카카오 오픈채팅으로 소통하세요",
              "팀플 완료 후 블라인드 평가로 신뢰 배지를 쌓으세요",
            ].map((step, i) => (
              <div
                key={i}
                className="flex items-center gap-4 bg-card rounded-xl p-4 border shadow-sm"
              >
                <div className="gradient-primary w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {i + 1}
                </div>
                <span className="text-sm font-medium">{step}</span>
                <CheckCircle2 className="h-5 w-5 text-primary ml-auto shrink-0 opacity-50" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">
          지금 바로 시작하세요
        </h2>
        <p className="text-muted-foreground mb-8">
          무료로 가입하고 믿을 수 있는 팀원을 만나보세요.
        </p>
        <Button
          size="lg"
          onClick={() => (window.location.href = getLoginUrl())}
          className="gradient-primary text-white border-0 px-8 py-6 rounded-xl"
        >
          무료로 시작하기
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="gradient-primary w-6 h-6 rounded-lg flex items-center justify-center">
              <GraduationCap className="h-3 w-3 text-white" />
            </div>
            <span className="font-semibold text-foreground">A+ Mate</span>
          </div>
          <span>2026 A+ Mate. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}

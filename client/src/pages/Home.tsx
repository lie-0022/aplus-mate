import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import {
  GraduationCap,
  Shield,
  Star,
  ArrowRight,
  CheckCircle2,
  CalendarDays,
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
              백석대 수업 후기 · 시간표 · 팀플
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-tight">
              수업 후기부터 팀플까지,
              <br />
              <span className="text-transparent bg-clip-text gradient-primary inline-block">
                A+ Mate
              </span>{" "}
              하나로
            </h1>
            <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
              수강생이 남긴 진짜 수업 후기, 내 시간표·공강 매칭,
              <br />
              믿을 수 있는 팀플까지 한 곳에서.
            </p>
            <Button
              size="lg"
              onClick={() => (window.location.href = getLoginUrl())}
              className="gradient-primary text-white border-0 text-base px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all"
            >
              시작하기
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              백석대 구글 계정(@bu.ac.kr)으로 로그인해요. 구글 인증 화면이 떠도 정상이에요.
            </p>
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
              icon: Star,
              title: "진짜 수업 후기",
              desc: "이 수업 팀플 있나? 별점·팀플 유형·미리 짠 팀 허용까지, 수강생이 남긴 후기로 미리 확인해요.",
              color: "bg-primary/10 text-primary",
            },
            {
              icon: CalendarDays,
              title: "내 시간표 & 공강 매칭",
              desc: "수업을 넣으면 시간표가 자동으로. 개인 일정까지 더해 팀원과 공강이 겹치는 시간을 바로 찾아요.",
              color: "bg-sky-brand/10 text-sky-brand",
            },
            {
              icon: Shield,
              title: "믿을 수 있는 팀플",
              desc: "같은 수업 학생과 팀을 만들고, 팀플 후 블라인드 평가로 신뢰 배지를 쌓아요.",
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
              "들었던 수업에 별점·한줄평을 남겨요",
              "선배 후기로 다음 학기 수업을 골라요",
              "수업을 넣어 시간표를 채우고 공강을 확인해요",
              "같은 수업 팀원과 팀을 꾸리고 평가로 배지를 쌓아요",
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

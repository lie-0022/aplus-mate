import { ENV } from "./_core/env";
import { invokeLLM } from "./_core/llm";

// AI 보고서 초안 생성 — Manus forge LLM 게이트웨이(invokeLLM) 사용.
// 로컬 dev(forge 키 없음)에서는 DEV_LOCAL=1일 때 목 초안을 반환해 흐름을 검증한다.
// 배포(Manus)에서는 BUILT_IN_FORGE_API_KEY가 자동 주입되어 실 LLM 경로를 탄다.

export type ReportParams = {
  courseName: string;
  professor: string;
  teamType: string;
  memberCount: number;
  topic: string;
  details?: string;
  // 팀이 실제로 한 활동(완료 일정·제출 산출물) — 초안을 우리 팀에 맞게 구체화하는 컨텍스트.
  progress?: string[];
};

const TEAM_TYPE_KO: Record<string, string> = {
  project: "팀 프로젝트",
  study: "스터디",
  mentoring: "멘토링",
};

function buildMessages({
  courseName,
  professor,
  teamType,
  memberCount,
  topic,
  details,
  progress,
}: ReportParams) {
  const kind = TEAM_TYPE_KO[teamType] ?? "팀 프로젝트";
  const system = [
    "너는 한국 대학생의 수업 보고서 초안 작성을 돕는 어시스턴트야.",
    "다음 규칙을 지켜:",
    "- 한국어 마크다운으로 작성한다 (# 제목, ## 섹션).",
    "- 구조: 제목 → 1. 서론(배경·목적) → 2. 본론(소제목 2~4개로 핵심 내용 전개) → 3. 결론(요약·기대효과) → 참고문헌(형식 예시만, 실제 출처는 [채워주세요]로 표시).",
    "- 사실 단정이 필요한 통계·인용은 지어내지 말고 [확인 필요] 표시를 남긴다.",
    "- 분량은 한국어 800~1200자 내외의 초안 수준으로, 학생이 살을 붙이기 좋게 작성한다.",
  ].join("\n");

  const user = [
    `수업: ${courseName} (${professor} 교수)`,
    `활동 종류: ${kind} (${memberCount}명)`,
    `보고서 주제: ${topic}`,
    details ? `추가 요구사항: ${details}` : null,
    progress && progress.length > 0
      ? `\n팀이 실제로 진행한 활동(참고):\n${progress.map((p) => `- ${p}`).join("\n")}`
      : null,
    "",
    "위 정보를 바탕으로 보고서 초안을 작성해줘. 진행한 활동이 있으면 본론에 자연스럽게 반영해.",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
}

// 로컬 dev 목 초안 — LLM 키 없이 UI 흐름(생성→표시→복사)을 검증하기 위한 고정 골격.
function mockReport({ courseName, professor, topic, details }: ReportParams): string {
  return [
    `# ${topic}`,
    "",
    `> ⚠️ 로컬 개발용 목(mock) 초안입니다. 배포 환경에서는 AI가 실제 초안을 생성합니다.`,
    "",
    "## 1. 서론",
    `본 보고서는 ${courseName}(${professor} 교수) 수업의 일환으로 "${topic}"을(를) 다룬다. [배경과 목적을 채워주세요]`,
    "",
    "## 2. 본론",
    "### 2.1 핵심 개념",
    "[핵심 개념 정리]",
    "### 2.2 분석",
    details ? `요구사항(${details})을 반영한 분석을 작성하세요.` : "[분석 내용]",
    "",
    "## 3. 결론",
    "[요약 및 기대효과]",
    "",
    "## 참고문헌",
    "- [채워주세요]",
  ].join("\n");
}

export async function generateTeamReport(
  params: ReportParams
): Promise<{ content: string; generatedBy: "llm" | "mock" }> {
  if (!ENV.llmApiKey) {
    if (process.env.DEV_LOCAL === "1") {
      return { content: mockReport(params), generatedBy: "mock" };
    }
    throw new Error("AI 기능이 아직 준비되지 않았어요. 잠시 후 다시 시도해주세요.");
  }

  const result = await invokeLLM({ messages: buildMessages(params) });
  const raw = result.choices[0]?.message?.content;
  const content =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw)
        ? raw
            .filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join("\n")
        : "";

  if (!content.trim()) {
    throw new Error("보고서 생성에 실패했어요. 다시 시도해주세요.");
  }
  return { content, generatedBy: "llm" };
}

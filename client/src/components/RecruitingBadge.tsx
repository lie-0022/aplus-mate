// "이 수업에서 팀 구하고 있어요" — 열린 모집공고가 있으면 수업 카드에 뜨는 라이브 신호.
// 은은한 펄스 점 + 하늘색 알약으로 "지금 살아있는 활동"임을 드러낸다.
export function RecruitingBadge({ count }: { count: number }) {
  return (
    <span className="badge-sky inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-60 animate-ping" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
      </span>
      지금 {count}팀이 팀원 구하는 중
    </span>
  );
}

export default RecruitingBadge;

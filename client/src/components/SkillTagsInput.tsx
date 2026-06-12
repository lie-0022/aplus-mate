import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";

// 팀플 맥락에서 자주 쓰는 역할/스킬 — 클릭 한 번으로 추가해 입력 부담을 줄인다.
const DEFAULT_SUGGESTIONS = [
  "기획",
  "발표",
  "자료조사",
  "문서작성",
  "디자인",
  "개발",
  "PPT",
  "리더십",
];

const MAX_TAGS = 10;

/**
 * 스킬 태그 입력 — 칩 표시 + 직접 입력(Enter/＋) + 추천 태그.
 * value/onChange로 제어. 폼 안에서도 안전하도록 모든 버튼은 type="button".
 */
export function SkillTagsInput({
  value,
  onChange,
  suggestions = DEFAULT_SUGGESTIONS,
  placeholder = "스킬 입력 후 Enter (예: Python)",
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  const add = (raw: string) => {
    const tag = raw.trim();
    if (!tag || value.includes(tag) || value.length >= MAX_TAGS) return;
    onChange([...value, tag]);
    setInput("");
  };
  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  const remaining = suggestions.filter((s) => !value.includes(s));

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
              <button
                type="button"
                onClick={() => remove(tag)}
                className="ml-1 hover:text-destructive"
                aria-label={`${tag} 삭제`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(input);
            }
          }}
          placeholder={placeholder}
          className="text-sm"
          disabled={value.length >= MAX_TAGS}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => add(input)}
          disabled={!input.trim() || value.length >= MAX_TAGS}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {remaining.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {remaining.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="text-xs px-2 py-0.5 rounded-full border border-dashed text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

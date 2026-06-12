import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Eye, MessageSquare, Send } from "lucide-react";
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

// 게시글 상세 + 익명 댓글. 게시판 정책과 동일하게 작성자 식별정보는 표시하지 않는다.
export default function PostDetail() {
  const params = useParams<{ id: string }>();
  const postId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: post, isLoading, isError } = trpc.posts.get.useQuery({ id: postId });
  const comments = trpc.posts.comments.useQuery({ postId });

  const [comment, setComment] = useState("");
  const addComment = trpc.posts.addComment.useMutation({
    onSuccess: () => {
      utils.posts.comments.invalidate({ postId });
      setComment("");
      toast.success("댓글을 남겼어요!");
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">게시글을 찾을 수 없습니다.</p>
        <Button variant="link" onClick={() => setLocation("/courses")}>
          수업 목록으로
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => setLocation(`/courses/${post.courseId}`)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> 수업으로
      </button>

      {/* 본문 */}
      <Card className="border shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">
              {post.category}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Eye className="h-3 w-3" /> {post.viewCount}
            </span>
          </div>
          <h1 className="font-bold text-lg leading-snug">{post.title}</h1>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{post.content}</p>
          <div className="text-xs text-muted-foreground pt-1 border-t">
            익명 · {new Date(post.createdAt).toLocaleDateString("ko-KR")}
          </div>
        </CardContent>
      </Card>

      {/* 댓글 */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            댓글 ({comments.data?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
          {comments.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              첫 댓글을 남겨보세요. 댓글도 익명으로 표시돼요.
            </p>
          )}
          {comments.data?.map((c) => (
            <div key={c.id} className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm whitespace-pre-wrap">{c.content}</p>
              <div className="text-xs text-muted-foreground mt-1.5">
                익명 ·{" "}
                {new Date(c.createdAt).toLocaleString("ko-KR", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ))}

          <div className="flex flex-col gap-2 pt-1">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="댓글을 입력하세요 (익명)"
              rows={2}
              maxLength={1000}
            />
            <Button
              className="self-end gradient-primary text-white border-0"
              size="sm"
              onClick={() => {
                if (!comment.trim()) {
                  toast.error("댓글 내용을 입력해주세요.");
                  return;
                }
                addComment.mutate({ postId, content: comment.trim() });
              }}
              disabled={addComment.isPending}
            >
              <Send className="mr-1 h-3.5 w-3.5" />
              {addComment.isPending ? "등록 중..." : "등록"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

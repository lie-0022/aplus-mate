import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, ArrowRight, UserCircle } from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";

export default function Teams() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.teams.list.useQuery();
  const [tab, setTab] = useState("active");

  const activeTeams = useMemo(
    () => data?.filter((t) => t.team.status === "active") || [],
    [data]
  );
  const completedTeams = useMemo(
    () => data?.filter((t) => t.team.status === "completed") || [],
    [data]
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  const renderTeamList = (teamList: typeof activeTeams) => {
    if (teamList.length === 0) {
      return (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {tab === "active" ? "진행 중인 팀이 없어요" : "완료된 팀이 없어요"}
            </p>
          </CardContent>
        </Card>
      );
    }

    return teamList.map((item) => (
      <Card
        key={item.team.id}
        className="border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setLocation(`/teams/${item.team.id}`)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="font-medium text-sm">{item.course.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {item.course.professor}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {item.team.evaluationStatus === "in_progress" && (
                <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
                  평가 진행 중
                </Badge>
              )}
              {item.team.evaluationStatus === "done" && (
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                  평가 완료
                </Badge>
              )}
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {item.members.map((m) => (
              <div
                key={m.teamMember.id}
                className="flex items-center gap-1.5 bg-muted rounded-full px-2.5 py-1"
              >
                <UserCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium">{m.user.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    ));
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">내 팀</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="active" className="flex-1">
            진행 중 ({activeTeams.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex-1">
            완료 ({completedTeams.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4 space-y-3">
          {renderTeamList(activeTeams)}
        </TabsContent>
        <TabsContent value="completed" className="mt-4 space-y-3">
          {renderTeamList(completedTeams)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

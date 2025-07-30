import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";

export default function ContactCards() {
  const { data: recentInteractions, isLoading: loadingInteractions } = useQuery({
    queryKey: ["/api/interactions/recent"],
    refetchInterval: 300000,
  });

  if (loadingInteractions) {
    return (
      <div className="space-y-6">
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-40 bg-muted rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusColor = (interaction: any) => {
    if (!interaction.contact.lastContact) return "bg-gray-500";
    
    const daysSinceContact = Math.floor(
      (Date.now() - new Date(interaction.contact.lastContact).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceContact <= 1) return "bg-green-500";
    if (daysSinceContact <= 7) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getStatusText = (interaction: any) => {
    if (!interaction.contact.lastContact) return "No Contact";
    
    const daysSinceContact = Math.floor(
      (Date.now() - new Date(interaction.contact.lastContact).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceContact <= 1) return "Recent Contact";
    if (daysSinceContact <= 7) return "Follow Up Soon";
    return "Needs Attention";
  };

  const mockGoals = [
    { title: "Weight Management", current: 8, target: 10, unit: "lbs" },
    { title: "Stress Reduction", current: 7, target: 10, unit: "sessions" },
    { title: "Sleep Quality", current: 6, target: 8, unit: "weeks" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Recent Client Activity</CardTitle>
            <Button variant="ghost" size="sm" className="text-primary">
              View All
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {recentInteractions && Array.isArray(recentInteractions) && recentInteractions.length > 0 ? (
            recentInteractions.slice(0, 3).map((interaction: any) => (
              <div
                key={interaction.id}
                className="flex items-start space-x-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
              >
                <img
                  src={`https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=48&h=48&fit=crop&crop=face&auto=format`}
                  alt={interaction.contact.name}
                  className="w-12 h-12 rounded-full"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-foreground">
                      {interaction.contact.name}
                    </h4>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(interaction.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {interaction.content}
                  </p>
                  <div className="flex items-center mt-2 space-x-4">
                    <div className="flex items-center space-x-1">
                      <div className={`w-2 h-2 ${getStatusColor(interaction)} rounded-full`} />
                      <span className="text-xs text-muted-foreground">
                        {getStatusText(interaction)}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Type: {interaction.type}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No recent interactions found. Start syncing your Google services to see client activity.
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Client Progress Overview</h3>
          
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="goals">Goals</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-4 mt-6">
              {mockGoals.map((goal, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">
                      {goal.title}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {goal.current}/{goal.target} {goal.unit}
                    </span>
                  </div>
                  <Progress 
                    value={(goal.current / goal.target) * 100} 
                    className="h-2"
                  />
                </div>
              ))}
            </TabsContent>
            
            <TabsContent value="timeline" className="mt-6">
              <div className="text-center py-8 text-muted-foreground">
                Timeline view will show chronological client interactions
              </div>
            </TabsContent>
            
            <TabsContent value="goals" className="mt-6">
              <div className="text-center py-8 text-muted-foreground">
                Detailed goal tracking and management
              </div>
            </TabsContent>
            
            <TabsContent value="documents" className="mt-6">
              <div className="text-center py-8 text-muted-foreground">
                Client documents and session notes
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

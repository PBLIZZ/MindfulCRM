import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Calendar, Trophy, TrendingUp } from "lucide-react";

export default function StatsCards() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    refetchInterval: 300000, // Refetch every 5 minutes
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Clients",
      value: (stats as any)?.totalClients || 0,
      change: "+12%",
      changeText: "vs last month",
      icon: Users,
      iconBg: "bg-teal-100 dark:bg-teal-800",
      iconColor: "text-teal-600 dark:text-teal-300",
    },
    {
      title: "Sessions This Week",
      value: (stats as any)?.weeklySessions || 0,
      change: "+8%",
      changeText: "vs last week",
      icon: Calendar,
      iconBg: "bg-blue-100 dark:bg-blue-800",
      iconColor: "text-blue-600 dark:text-blue-300",
    },
    {
      title: "Goals Achieved",
      value: (stats as any)?.achievedGoals || 0,
      change: "+15%",
      changeText: "vs last month",
      icon: Trophy,
      iconBg: "bg-green-100 dark:bg-green-800",
      iconColor: "text-green-600 dark:text-green-300",
    },
    {
      title: "Response Rate",
      value: `${(stats as any)?.responseRate || 0}%`,
      change: "+3%",
      changeText: "vs last month",
      icon: TrendingUp,
      iconBg: "bg-orange-100 dark:bg-orange-800",
      iconColor: "text-orange-600 dark:text-orange-300",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statCards.map((stat, index) => (
        <Card key={index} className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {stat.value}
                </p>
              </div>
              <div className={`w-12 h-12 ${stat.iconBg} rounded-lg flex items-center justify-center`}>
                <stat.icon className={`h-6 w-6 ${stat.iconColor}`} />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <span className="text-green-500 text-sm font-medium">{stat.change}</span>
              <span className="text-muted-foreground text-sm ml-2">{stat.changeText}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

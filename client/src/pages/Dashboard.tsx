import StatsCards from "@/components/Dashboard/StatsCards";
import ContactCards from "@/components/Dashboard/ContactCards";
import AIAssistant from "@/components/Dashboard/AIAssistant";

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your client relationships and activities
        </p>
      </div>
      
      <StatsCards />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ContactCards />
        </div>
        <div>
          <AIAssistant />
        </div>
      </div>
    </div>
  );
}

import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import logoPath from "@assets/logo_1753860249688.png";
import { useQuery } from "@tanstack/react-query";

const navigation = [
  { name: 'Dashboard', href: '/', icon: 'fas fa-th-large' },
  { name: 'Contacts', href: '/contacts', icon: 'fas fa-users' },
  { name: 'Calendar', href: '/calendar', icon: 'fas fa-calendar' },
  { name: 'AI Assistant', href: '/assistant', icon: 'fas fa-robot' },
  { name: 'Analytics', href: '/analytics', icon: 'fas fa-chart-line' },
  { name: 'Settings', href: '/settings', icon: 'fas fa-cog' },
];

export default function Sidebar() {
  const [location] = useLocation();
  
  const { data: syncStatus } = useQuery({
    queryKey: ["/api/sync/status"],
    refetchInterval: 60000, // Refetch every minute
  });

  const getLastSyncText = () => {
    if (!syncStatus || !Array.isArray(syncStatus) || syncStatus.length === 0) return "Never synced";
    
    const latestSync = syncStatus.reduce((latest: any, current: any) => {
      return new Date(current.lastSync) > new Date(latest.lastSync) ? current : latest;
    });
    
    const lastSyncDate = new Date(latestSync.lastSync);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - lastSyncDate.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getSyncStatusColor = () => {
    if (!syncStatus || !Array.isArray(syncStatus) || syncStatus.length === 0) return "bg-gray-500";
    
    const hasError = syncStatus.some((s: any) => s.status === 'error');
    if (hasError) return "bg-red-500";
    
    return "bg-green-500";
  };

  return (
    <aside className="w-64 bg-card border-r border-border shadow-sm">
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <img src={logoPath} alt="Wellness Hub Logo" className="w-10 h-10 rounded-lg" />
          <div>
            <h1 className="text-lg font-bold text-teal-700 dark:text-teal-300">Wellness Hub</h1>
            <p className="text-xs text-muted-foreground">Data Intelligence</p>
          </div>
        </div>
      </div>
      
      <nav className="p-4">
        <ul className="space-y-2">
          {navigation.map((item) => (
            <li key={item.name}>
              <a
                href={item.href}
                className={cn(
                  "flex items-center space-x-3 p-3 rounded-lg font-medium transition-colors",
                  location === item.href
                    ? "bg-teal-50 dark:bg-teal-800 text-teal-700 dark:text-teal-200"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                )}
              >
                <i className={cn(item.icon, "w-5")} />
                <span>{item.name}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      
      {/* Sync Status */}
      <div className="p-4 border-t border-border">
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <div className={cn("w-2 h-2 rounded-full animate-pulse", getSyncStatusColor())} />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              {getLastSyncText()}
            </span>
          </div>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
            Gmail • Calendar • Drive
          </p>
        </div>
      </div>
    </aside>
  );
}

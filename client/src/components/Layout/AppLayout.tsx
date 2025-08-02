import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { useEffect } from 'react';
import { Link } from 'wouter';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import logoPath from '@assets/logo_1753860249688.png';
import {
  Home,
  Users,
  Bot,
  Settings,
  ChevronDown,
  LogOut,
  Monitor,
  Sun,
  Moon,
  CheckSquare,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTheme } from '@/contexts/ThemeContext';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Contacts', href: '/contacts', icon: Users },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const quickActions = [
  { name: 'New Contact', href: '/contacts?new=true', icon: Users },
  { name: 'AI Chat', href: '/assistant', icon: Bot },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, isLoading, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [location, setLocation] = useLocation();

  const { data: syncStatus } = useQuery({
    queryKey: ['/api/sync/status'],
    refetchInterval: 60000, // Refetch every minute
  });

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation('/login');
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-background'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const getLastSyncText = () => {
    if (!syncStatus || !Array.isArray(syncStatus) || syncStatus.length === 0)
      return 'Last synced: Never';

    const latestSync = syncStatus.reduce((latest: any, current: any) => {
      return new Date(current.lastSync) > new Date(latest.lastSync) ? current : latest;
    });

    const lastSyncDate = new Date(latestSync.lastSync);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - lastSyncDate.getTime()) / (1000 * 60));

    if (diffMinutes < 1) return 'Last synced: Just now';
    if (diffMinutes < 60) return `Last synced: ${diffMinutes} min ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Last synced: ${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `Last synced: ${diffDays}d ago`;
  };

  const getSyncStatusColor = () => {
    if (!syncStatus || !Array.isArray(syncStatus) || syncStatus.length === 0) return 'bg-gray-500';

    const hasError = syncStatus.some((s: any) => s.status === 'error');
    if (hasError) return 'bg-red-500';

    return 'bg-green-500';
  };

  const getThemeIcon = (themeValue: string) => {
    switch (themeValue) {
      case 'light':
        return <Sun className='h-4 w-4' />;
      case 'dark':
        return <Moon className='h-4 w-4' />;
      default:
        return <Monitor className='h-4 w-4' />;
    }
  };

  const getThemeLabel = (themeValue: string) => {
    switch (themeValue) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      default:
        return 'System';
    }
  };

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <SidebarProvider>
      <Sidebar variant='inset'>
        <SidebarHeader>
          <div className='flex items-center space-x-3 px-2 py-2'>
            <img src={logoPath} alt='Wellness Hub Logo' className='w-8 h-8 rounded-lg' />
            <div className='group-data-[collapsible=icon]:hidden'>
              <h1 className='text-lg font-bold text-teal-700 dark:text-teal-300'>OmniCRM</h1>
              <p className='text-xs text-muted-foreground'>Data Intelligence</p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.href}
                        className={cn(
                          'w-full justify-start',
                          location === item.href &&
                            'bg-teal-50 dark:bg-teal-800 text-teal-700 dark:text-teal-200 hover:bg-teal-50 dark:hover:bg-teal-800'
                        )}
                      >
                        <Link href={item.href}>
                          <Icon className='h-4 w-4' />
                          <span>{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          <SidebarGroup>
            <SidebarGroupLabel>Quick Actions</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {quickActions.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton asChild size='sm'>
                        <Link href={item.href}>
                          <Icon className='h-3 w-3' />
                          <span className='text-xs'>{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <div className='p-2'>
            <div className='bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3'>
              <div className='flex items-center space-x-2'>
                <div className={cn('w-2 h-2 rounded-full animate-pulse', getSyncStatusColor())} />
                <span className='text-sm font-medium text-green-700 dark:text-green-300 group-data-[collapsible=icon]:hidden'>
                  {getLastSyncText()}
                </span>
              </div>
              <p className='text-xs text-green-600 dark:text-green-400 mt-1 group-data-[collapsible=icon]:hidden'>
                Gmail • Calendar • Drive
              </p>
            </div>
          </div>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className='flex h-16 shrink-0 items-center justify-between gap-2 px-4 border-b'>
          <div className='flex items-center gap-2'>
            <SidebarTrigger className='-ml-1' />
            <div className='text-sm font-semibold'>Welcome back, {user?.name || 'User'}</div>
          </div>

          <div className='flex items-center gap-4'>
            {/* User Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' className='flex items-center gap-2 h-8 px-2'>
                  <Avatar className='h-6 w-6'>
                    <AvatarImage src={user?.picture || undefined} alt={user?.name || 'User'} />
                    <AvatarFallback className='text-xs'>
                      {getUserInitials(user?.name || 'User')}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className='h-3 w-3' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-56'>
                <DropdownMenuLabel className='font-normal'>
                  <div className='flex flex-col space-y-1'>
                    <p className='text-sm font-medium leading-none'>{user?.name || 'User'}</p>
                    <p className='text-xs leading-none text-muted-foreground'>
                      {user?.email || 'user@example.com'}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* Theme Selection */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    {getThemeIcon(theme)}
                    <span>Theme: {getThemeLabel(theme)}</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => setTheme('system')}>
                      <Monitor className='h-4 w-4 mr-2' />
                      System
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme('light')}>
                      <Sun className='h-4 w-4 mr-2' />
                      Light
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme('dark')}>
                      <Moon className='h-4 w-4 mr-2' />
                      Dark
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => setLocation('/settings')}>
                  <Settings className='h-4 w-4 mr-2' />
                  Settings
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={logout}>
                  <LogOut className='h-4 w-4 mr-2' />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <div className='flex flex-1 flex-col gap-4 p-4 pt-0 overflow-auto'>
          <div className='min-h-0'>{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

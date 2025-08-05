import { useAuth } from '@/contexts/AuthContext.js';

export default function Header() {
  const { user } = useAuth();

  return (
    <header className='bg-card border-b border-border px-6 py-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-2xl font-bold text-foreground'>Dashboard</h2>
          <p className='text-muted-foreground'>Welcome back, {user?.name ?? 'User'}</p>
        </div>
      </div>
    </header>
  );
}

import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import logoPath from '@assets/logo_1753860249688.png';

export default function Login() {
  const { user, isLoading, login } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && !isLoading) {
      setLocation('/');
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-background'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
      </div>
    );
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-linear-to-br from-teal-50 to-teal-100 dark:from-teal-900 dark:to-teal-800'>
      <Card className='bg-linear-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600w-full max-w-md mx-4 shadow-xl'>
        <CardHeader className='space-y-4 text-center'>
          <div className='flex justify-center'>
            <img src={logoPath} alt='Wellness Hub Logo' className='w-16 h-16 rounded-lg' />
          </div>
          <div>
            <CardTitle className='text-2xl font-bold text-teal-700 dark:text-teal-300'>
              OmniCRM
              <span className='text-sm block text-teal-700 dark:text-teal-300'>
                by omnipotency.ai
              </span>
            </CardTitle>
            <CardDescription className='text-teal-600 dark:text-teal-400'>
              AI-Powered Relationship Management
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className='space-y-6'>
          <div className='text-center space-y-2'>
            <h2 className='text-lg font-semibold text-teal-700 dark:text-teal-300'>Welcome Back</h2>
            <p className='text-sm text-teal-600 dark:text-teal-400'>
              Sign in with your Google account to access your wellness dashboard
            </p>
          </div>

          <Button
            onClick={login}
            className='w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2'
          >
            <svg className='w-5 h-5' viewBox='0 0 24 24'>
              <path
                fill='currentColor'
                d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
              />
              <path
                fill='currentColor'
                d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
              />
              <path
                fill='currentColor'
                d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
              />
              <path
                fill='currentColor'
                d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
              />
            </svg>
            <span>Continue with Google</span>
          </Button>

          <div className='text-xs text-center text-gray-500 dark:text-gray-400'>
            By signing in, you agree to access your Gmail, Calendar, and Drive data for client
            relationship management purposes.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

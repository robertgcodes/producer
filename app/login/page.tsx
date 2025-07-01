'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isResetPassword) {
        await resetPassword(email);
        setSuccess('Password reset email sent! Check your inbox.');
        setIsResetPassword(false);
      } else if (isSignUp) {
        await signUp(email, password);
        router.push('/dashboard');
      } else {
        await signIn(email, password);
        router.push('/dashboard');
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      
      // Enhanced error messages for common Firebase auth errors
      let errorMessage = error.message;
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address format.';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection.';
      } else if (error.code === 'auth/invalid-credential') {
        errorMessage = 'Invalid email or password. Please check your credentials.';
      } else if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account already exists with this email.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters.';
      }
      
      setError(`${errorMessage} (Error code: ${error.code || 'unknown'})`);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    
    try {
      await signInWithGoogle();
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Google auth error:', error);
      
      let errorMessage = error.message;
      
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign-in popup was closed.';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = 'Sign-in popup was blocked. Please allow popups for this site.';
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = 'Another popup is already open.';
      } else if (error.code === 'auth/unauthorized-domain') {
        errorMessage = 'This domain is not authorized for Google sign-in.';
      }
      
      setError(`${errorMessage} (Error code: ${error.code || 'unknown'})`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950" suppressHydrationWarning>
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-purple-700 to-purple-900 p-12 flex-col justify-between relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-72 h-72 bg-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/2 translate-y-1/2"></div>
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-4xl font-bold text-white">Watcher Pro</h2>
              <p className="text-blue-100">Beta Access</p>
            </div>
          </div>
          <p className="text-blue-100 text-lg font-medium max-w-md">The AI-powered show production tool for "Watching the Watchers" and other news analysis livestreams</p>
        </div>
        
        <div className="space-y-8 relative z-10">
          <div className="feature-card bg-white/10 backdrop-blur-sm rounded-xl p-4 flex gap-4">
            <div className="feature-icon bg-white/20 rounded-lg p-2">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" suppressHydrationWarning>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-1.5 text-lg">Smart Story Bundling</h3>
              <p className="text-blue-100 text-sm leading-relaxed">AI groups related stories across all your sources automatically</p>
            </div>
          </div>
          
          <div className="feature-card bg-white/10 backdrop-blur-sm rounded-xl p-4 flex gap-4">
            <div className="feature-icon bg-white/20 rounded-lg p-2">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" suppressHydrationWarning>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-1.5 text-lg">Multi-Source Feeds</h3>
              <p className="text-blue-100 text-sm leading-relaxed">RSS, YouTube, Twitter/X, and Google News in one dashboard</p>
            </div>
          </div>
          
          <div className="feature-card bg-white/10 backdrop-blur-sm rounded-xl p-4 flex gap-4">
            <div className="feature-icon bg-white/20 rounded-lg p-2">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" suppressHydrationWarning>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-1.5 text-lg">Research Assistant</h3>
              <p className="text-blue-100 text-sm leading-relaxed">Deep-dive research on people, organizations, and stories</p>
            </div>
          </div>
        </div>
        
        <p className="text-blue-100 text-sm relative z-10">
          © 2024 WatcherPro.ai • Made for livestreamers who never miss a story
        </p>
      </div>
      
      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Theme Toggle */}
          <div className="flex justify-end mb-8">
            <ThemeToggle />
          </div>
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
              {isResetPassword ? 'Reset Password' : isSignUp ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              {isResetPassword ? 'Enter your email to receive a password reset link' : isSignUp ? 'Start organizing your show content' : 'Sign in to your workspace'}
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}
            
            {success && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
              </div>
            )}
            
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2.5">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="input-modern"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            {!isResetPassword && (
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2.5">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  required
                  className="input-modern"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
            
            {!isSignUp && !isResetPassword && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsResetPassword(true);
                    setError('');
                    setSuccess('');
                  }}
                  className="text-sm font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300"
                >
                  Forgot password?
                </button>
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className="btn-modern btn-modern-primary w-full"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" suppressHydrationWarning>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {isResetPassword ? 'Sending Reset Email...' : isSignUp ? 'Creating Account...' : 'Signing In...'}
                </>
              ) : (
                isResetPassword ? 'Send Reset Email' : isSignUp ? 'Create Account' : 'Sign In'
              )}
            </button>
          </form>
          
          {!isResetPassword && (
            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-700" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-gray-50 dark:bg-gray-950 text-gray-500 dark:text-gray-400 font-medium">
                    Or continue with
                  </span>
                </div>
              </div>
            
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="btn-modern btn-modern-secondary w-full mt-6"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" suppressHydrationWarning>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>
            </div>
          )}
          
          <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
            {isResetPassword ? (
              <>
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsResetPassword(false);
                    setError('');
                    setSuccess('');
                  }}
                  className="font-semibold text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
                >
                  Back to sign in
                </button>
              </>
            ) : (
              <>
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError('');
                    setSuccess('');
                  }}
                  className="font-semibold text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
                >
                  {isSignUp ? 'Sign in' : 'Sign up'}
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
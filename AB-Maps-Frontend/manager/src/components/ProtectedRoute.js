import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const LOGIN_URL = process.env.REACT_APP_LOGIN_URL || '/login';
const DASHBOARD_URL = process.env.REACT_APP_FRONTEND_URL || '/';

const ProtectedRoute = ({ children, requiredUserType = null }) => {
  const { user, isLoading, error, isAuthenticated } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // Show error if authentication failed
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="mb-6">
            <div className="h-16 w-16 text-red-500 mx-auto mb-4 flex items-center justify-center">
              <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Authentication Failed</h1>
            <p className="text-gray-600 mb-4">
              {error}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Please log in through the sales dashboard to access AB Maps.
            </p>
            <div className="text-xs text-gray-400 bg-gray-100 p-3 rounded">
              <p><strong>Debug Info:</strong></p>
              <p>URL Token: {window.location.search.includes('token=') ? 'Present' : 'Missing'}</p>
              <p>Error: {error}</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <button
              onClick={() => {
                // Check if we're in a popup/iframe
                if (window.opener) {
                  // If opened from sales dashboard, close this window
                  window.close();
                } else {
                  // Otherwise redirect to login
                  window.location.href = LOGIN_URL;
                }
              }}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {window.opener ? 'Close Window' : 'Go to Login'}
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check if user is authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="mb-6">
            <div className="h-16 w-16 text-red-500 mx-auto mb-4 flex items-center justify-center">
              <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">
              You need to be logged in to access AB Maps.
            </p>
          </div>
          
          <button
            onClick={() => {
              // Check if we're in a popup/iframe
              if (window.opener) {
                // If opened from sales dashboard, close this window
                window.close();
              } else {
                // Otherwise redirect to login
                window.location.href = LOGIN_URL;
              }
            }}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {window.opener ? 'Close Window' : 'Go to Login'}
          </button>
        </div>
      </div>
    );
  }

  // Check user type if required
  if (requiredUserType && user?.user_type !== requiredUserType) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="mb-6">
            <div className="h-16 w-16 text-red-500 mx-auto mb-4 flex items-center justify-center">
              <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 2.25a9.75 9.75 0 100 19.5 9.75 9.75 0 000-19.5z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">
              This area is restricted to {requiredUserType}s only.
            </p>
          </div>
          
          <button
            onClick={() => window.location.href = DASHBOARD_URL}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Render protected content
  return children;
};

export default ProtectedRoute; 
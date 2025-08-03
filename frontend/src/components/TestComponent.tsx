import React from 'react';

export const TestComponent: React.FC = () => {
  console.log('TestComponent rendered');
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          App is Working! 🎉
        </h1>
        <p className="text-gray-600 mb-4">
          This confirms that React is rendering properly.
        </p>
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          <strong>Success:</strong> Frontend deployment is working correctly.
        </div>
        <div className="mt-4 text-sm text-gray-500">
          Current URL: {window.location.href}
        </div>
      </div>
    </div>
  );
};

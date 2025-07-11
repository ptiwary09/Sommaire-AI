'use client';
import React, { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

export default function SkeletonLoadingPage() {
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Simulate loading progress
  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + Math.random() * 8;
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* Left Side - Main Content */}
          <div className="lg:col-span-2">
            <Card className="p-6 bg-white shadow-sm border border-gray-200 rounded-lg">
              
              {/* Progress Bar */}
              <div className="mb-6">
                <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-pink-400 to-red-400 h-1 transition-all duration-500 ease-out"
                    style={{ width: `${Math.min(loadingProgress, 100)}%` }}
                  />
                </div>
              </div>

              {/* Title Section */}
              <div className="mb-8">
                <Skeleton className="h-12 w-3/4 bg-pink-100 rounded-lg" />
              </div>

              {/* Content List */}
              <div className="space-y-4">
                {[1, 2, 3, 4, 5, 6].map((_, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      <Skeleton className="h-10 w-10 rounded-full bg-pink-200" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-full bg-gray-200 rounded" />
                      <Skeleton className="h-4 w-3/4 bg-gray-200 rounded" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Navigation */}
              <div className="mt-8 flex justify-between items-center">
                <Skeleton className="h-10 w-24 bg-gray-200 rounded-lg" />
                <div className="flex gap-2">
                  {[1, 2, 3].map((_, index) => (
                    <Skeleton key={index} className="h-2 w-2 rounded-full bg-gray-300" />
                  ))}
                </div>
                <Skeleton className="h-10 w-24 bg-gray-200 rounded-lg" />
              </div>
            </Card>
          </div>

          {/* Right Side - Additional Content */}
          <div className="lg:col-span-1">
            <Card className="p-6 bg-white shadow-sm border border-gray-200 rounded-lg">
              {/* Additional skeleton content */}
              <div className="space-y-4">
                <div>
                  <Skeleton className="h-4 w-24 bg-gray-200 rounded mb-2" />
                  <Skeleton className="h-16 w-full bg-gray-100 rounded-lg" />
                </div>
                
                <div>
                  <Skeleton className="h-4 w-20 bg-gray-200 rounded mb-2" />
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-full bg-gray-100 rounded" />
                    <Skeleton className="h-3 w-3/4 bg-gray-100 rounded" />
                    <Skeleton className="h-3 w-1/2 bg-gray-100 rounded" />
                  </div>
                </div>

                <div>
                  <Skeleton className="h-4 w-28 bg-gray-200 rounded mb-2" />
                  <div className="grid grid-cols-2 gap-2">
                    <Skeleton className="h-8 bg-gray-100 rounded" />
                    <Skeleton className="h-8 bg-gray-100 rounded" />
                  </div>
                </div>
              </div>

              {/* Bottom action */}
              <div className="mt-6 pt-4 border-t border-gray-100">
                <Skeleton className="h-10 w-full bg-blue-100 rounded-lg" />
              </div>
            </Card>
          </div>
        </div>

        {/* Processing PDF Popup - Top Right Corner */}
        <div className="fixed top-4 right-4 z-50 max-w-sm">
          <Card className="bg-white shadow-lg border border-gray-200 rounded-lg p-4 animate-slide-in">
            <div className="flex items-start gap-3">
              <div className="text-lg animate-pulse">📄</div>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 mb-1">Processing PDF...</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Hang tight! Our AI is reading through your document!
                </p>
                
                {/* Progress indicator */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-1">
                    <div 
                      className="bg-blue-500 h-1 rounded-full transition-all duration-1000"
                      style={{ width: `${Math.min(loadingProgress * 0.8, 80)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">
                    {Math.round(Math.min(loadingProgress * 0.8, 80))}%
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
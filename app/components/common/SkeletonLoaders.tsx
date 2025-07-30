'use client';

import React from 'react';

// Base skeleton component
function Skeleton({
  className = '',
  width,
  height,
}: {
  className?: string;
  width?: string | number;
  height?: string | number;
}) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded ${className}`}
      style={{ width, height }}
    />
  );
}

// Thread list skeleton
export function ThreadListSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="p-4 border-b border-gray-100">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <Skeleton className="h-4 mb-2" width="75%" />
                <Skeleton className="h-3" width="50%" />
              </div>
              <div className="flex flex-col items-end ml-2">
                <Skeleton className="h-3 mb-1" width="30px" />
                <Skeleton className="h-2 w-2 rounded-full" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 rounded-full" width="60px" />
                <Skeleton className="h-5 rounded-full" width="50px" />
                <Skeleton className="h-5 rounded-full" width="40px" />
              </div>
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Thread view skeleton
export function ThreadViewSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6" width="60%" />
          <Skeleton className="h-8 rounded-md" width="80px" />
        </div>

        <div className="flex items-center gap-4">
          <Skeleton className="h-4" width="120px" />
          <Skeleton className="h-4" width="100px" />
          <Skeleton className="h-4" width="80px" />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div>
                  <Skeleton className="h-4 mb-1" width="120px" />
                  <Skeleton className="h-3" width="80px" />
                </div>
              </div>
              <Skeleton className="h-3" width="60px" />
            </div>

            <div className="space-y-2">
              <Skeleton className="h-4" width="100%" />
              <Skeleton className="h-4" width="90%" />
              <Skeleton className="h-4" width="75%" />
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="bg-white border-t border-gray-200 p-6">
        <Skeleton className="h-32 rounded-lg mb-4" />
        <div className="flex justify-between">
          <Skeleton className="h-8 rounded-md" width="100px" />
          <Skeleton className="h-8 rounded-md" width="80px" />
        </div>
      </div>
    </div>
  );
}

// Search results skeleton
export function SearchResultsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="bg-white rounded-lg border p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <Skeleton className="h-5 mb-2" width="70%" />
              <Skeleton className="h-4" width="50%" />
            </div>
            <Skeleton className="h-4" width="60px" />
          </div>

          <div className="space-y-2 mb-3">
            <Skeleton className="h-3" width="100%" />
            <Skeleton className="h-3" width="85%" />
          </div>

          <div className="flex items-center gap-2">
            <Skeleton className="h-5 rounded-full" width="50px" />
            <Skeleton className="h-5 rounded-full" width="60px" />
            <Skeleton className="h-5 rounded-full" width="40px" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Comments skeleton
export function CommentsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 mb-1" width="100px" />
              <Skeleton className="h-3" width="60px" />
            </div>
          </div>

          <div className="space-y-2 mb-3">
            <Skeleton className="h-4" width="100%" />
            <Skeleton className="h-4" width="80%" />
          </div>

          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded" />
            <Skeleton className="h-6 w-6 rounded" />
            <Skeleton className="h-6 w-6 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Analytics skeleton
export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-white rounded-lg border p-6">
            <Skeleton className="h-4 mb-2" width="60%" />
            <Skeleton className="h-8 mb-1" width="40%" />
            <Skeleton className="h-3" width="80%" />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border p-6">
          <Skeleton className="h-6 mb-4" width="50%" />
          <Skeleton className="h-64" />
        </div>
        <div className="bg-white rounded-lg border p-6">
          <Skeleton className="h-6 mb-4" width="50%" />
          <Skeleton className="h-64" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border">
        <div className="p-6 border-b">
          <Skeleton className="h-6" width="40%" />
        </div>
        <div className="p-6">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-3 border-b last:border-b-0"
            >
              <Skeleton className="h-4" width="30%" />
              <Skeleton className="h-4" width="20%" />
              <Skeleton className="h-4" width="15%" />
              <Skeleton className="h-4" width="10%" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Generic card skeleton
export function CardSkeleton({
  rows = 3,
  showHeader = true,
}: {
  rows?: number;
  showHeader?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg border p-6">
      {showHeader && (
        <div className="mb-4">
          <Skeleton className="h-6 mb-2" width="50%" />
          <Skeleton className="h-4" width="75%" />
        </div>
      )}

      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-4"
            width={`${Math.random() * 30 + 60}%`}
          />
        ))}
      </div>
    </div>
  );
}

// Loading spinner component
export function LoadingSpinner({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div
      className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${sizeClasses[size]} ${className}`}
    />
  );
}

// Full page loading
export function FullPageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <LoadingSpinner size="lg" className="mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Loading...</h3>
        <p className="text-sm text-gray-500">
          Please wait while we load your data
        </p>
      </div>
    </div>
  );
}

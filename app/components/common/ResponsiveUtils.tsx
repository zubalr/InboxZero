'use client';

import React, { useEffect, useState } from 'react';

// Breakpoint definitions
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

type Breakpoint = keyof typeof breakpoints;

// Hook for responsive breakpoints
export function useBreakpoint() {
  const [currentBreakpoint, setCurrentBreakpoint] = useState<Breakpoint>('sm');
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      setWindowSize({ width, height });

      // Determine current breakpoint
      if (width >= breakpoints['2xl']) {
        setCurrentBreakpoint('2xl');
      } else if (width >= breakpoints.xl) {
        setCurrentBreakpoint('xl');
      } else if (width >= breakpoints.lg) {
        setCurrentBreakpoint('lg');
      } else if (width >= breakpoints.md) {
        setCurrentBreakpoint('md');
      } else {
        setCurrentBreakpoint('sm');
      }
    };

    // Set initial values
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isBreakpoint = (bp: Breakpoint) => currentBreakpoint === bp;
  const isBreakpointUp = (bp: Breakpoint) =>
    windowSize.width >= breakpoints[bp];
  const isBreakpointDown = (bp: Breakpoint) =>
    windowSize.width < breakpoints[bp];

  return {
    currentBreakpoint,
    windowSize,
    isBreakpoint,
    isBreakpointUp,
    isBreakpointDown,
    isMobile: isBreakpointDown('md'),
    isTablet: isBreakpoint('md'),
    isDesktop: isBreakpointUp('lg'),
  };
}

// Responsive container component
export function ResponsiveContainer({
  children,
  className = '',
  maxWidth = '7xl',
}: {
  children: React.ReactNode;
  className?: string;
  maxWidth?:
    | 'sm'
    | 'md'
    | 'lg'
    | 'xl'
    | '2xl'
    | '3xl'
    | '4xl'
    | '5xl'
    | '6xl'
    | '7xl'
    | 'full';
}) {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-full',
  };

  return (
    <div
      className={`mx-auto px-4 sm:px-6 lg:px-8 ${maxWidthClasses[maxWidth]} ${className}`}
    >
      {children}
    </div>
  );
}

// Responsive grid component
export function ResponsiveGrid({
  children,
  cols = { sm: 1, md: 2, lg: 3 },
  gap = 6,
  className = '',
}: {
  children: React.ReactNode;
  cols?: Partial<Record<Breakpoint, number>>;
  gap?: number;
  className?: string;
}) {
  const getGridClasses = () => {
    const classes = [`gap-${gap}`];

    Object.entries(cols).forEach(([breakpoint, colCount]) => {
      if (breakpoint === 'sm') {
        classes.push(`grid-cols-${colCount}`);
      } else {
        classes.push(`${breakpoint}:grid-cols-${colCount}`);
      }
    });

    return classes.join(' ');
  };

  return (
    <div className={`grid ${getGridClasses()} ${className}`}>{children}</div>
  );
}

// Mobile-first responsive text
export function ResponsiveText({
  children,
  size = { sm: 'base', lg: 'lg' },
  weight = 'normal',
  className = '',
}: {
  children: React.ReactNode;
  size?: Partial<
    Record<
      Breakpoint,
      'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl'
    >
  >;
  weight?: 'light' | 'normal' | 'medium' | 'semibold' | 'bold';
  className?: string;
}) {
  const getTextClasses = () => {
    const classes = [`font-${weight}`];

    Object.entries(size).forEach(([breakpoint, textSize]) => {
      if (breakpoint === 'sm') {
        classes.push(`text-${textSize}`);
      } else {
        classes.push(`${breakpoint}:text-${textSize}`);
      }
    });

    return classes.join(' ');
  };

  return <span className={`${getTextClasses()} ${className}`}>{children}</span>;
}

// Responsive spacing component
export function ResponsiveSpacing({
  children,
  padding = { sm: 4, lg: 8 },
  margin,
  className = '',
}: {
  children: React.ReactNode;
  padding?: Partial<Record<Breakpoint, number>>;
  margin?: Partial<Record<Breakpoint, number>>;
  className?: string;
}) {
  const getSpacingClasses = () => {
    const classes: string[] = [];

    if (padding) {
      Object.entries(padding).forEach(([breakpoint, space]) => {
        if (breakpoint === 'sm') {
          classes.push(`p-${space}`);
        } else {
          classes.push(`${breakpoint}:p-${space}`);
        }
      });
    }

    if (margin) {
      Object.entries(margin).forEach(([breakpoint, space]) => {
        if (breakpoint === 'sm') {
          classes.push(`m-${space}`);
        } else {
          classes.push(`${breakpoint}:m-${space}`);
        }
      });
    }

    return classes.join(' ');
  };

  return (
    <div className={`${getSpacingClasses()} ${className}`}>{children}</div>
  );
}

// Mobile navigation drawer
export function MobileDrawer({
  isOpen,
  onClose,
  children,
  position = 'left',
  className = '',
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  position?: 'left' | 'right';
  className?: string;
}) {
  const { isMobile } = useBreakpoint();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isMobile) {
    return <div className={className}>{children}</div>;
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 ${position}-0 h-full w-80 max-w-[80vw] bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50 ${
          isOpen
            ? 'translate-x-0'
            : position === 'left'
              ? '-translate-x-full'
              : 'translate-x-full'
        } ${className}`}
      >
        <div className="h-full overflow-y-auto">{children}</div>
      </div>
    </>
  );
}

// Responsive image component
export function ResponsiveImage({
  src,
  alt,
  sizes = { sm: '100vw', md: '50vw', lg: '33vw' },
  className = '',
  ...props
}: {
  src: string;
  alt: string;
  sizes?: Partial<Record<Breakpoint, string>>;
  className?: string;
  [key: string]: any;
}) {
  const getSizesString = () => {
    return Object.entries(sizes)
      .map(([breakpoint, size]) => {
        if (breakpoint === 'sm') {
          return size;
        }
        return `(min-width: ${breakpoints[breakpoint as Breakpoint]}px) ${size}`;
      })
      .join(', ');
  };

  return (
    <img
      src={src}
      alt={alt}
      sizes={getSizesString()}
      className={`w-full h-auto ${className}`}
      {...props}
    />
  );
}

// Responsive table wrapper
export function ResponsiveTable({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <div className="min-w-full inline-block align-middle">
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

// Responsive card stack (mobile) vs grid (desktop)
export function ResponsiveCardLayout({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { isMobile } = useBreakpoint();

  if (isMobile) {
    return <div className={`space-y-4 ${className}`}>{children}</div>;
  }

  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}
    >
      {children}
    </div>
  );
}

// Responsive sidebar layout
export function ResponsiveSidebar({
  sidebar,
  children,
  sidebarWidth = 'w-64',
  className = '',
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  sidebarWidth?: string;
  className?: string;
}) {
  const { isMobile } = useBreakpoint();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (isMobile) {
    return (
      <div className={className}>
        {/* Mobile header with menu button */}
        <div className="lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
          >
            <span className="sr-only">Open sidebar</span>
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>

        {/* Mobile drawer */}
        <MobileDrawer
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        >
          {sidebar}
        </MobileDrawer>

        {/* Main content */}
        <div className="flex-1">{children}</div>
      </div>
    );
  }

  return (
    <div className={`flex ${className}`}>
      {/* Desktop sidebar */}
      <div className={`${sidebarWidth} flex-shrink-0`}>{sidebar}</div>

      {/* Main content */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// Touch-friendly button for mobile
export function TouchFriendlyButton({
  children,
  onClick,
  className = '',
  ...props
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  [key: string]: any;
}) {
  const { isMobile } = useBreakpoint();

  return (
    <button
      onClick={onClick}
      className={`${
        isMobile ? 'min-h-[44px] min-w-[44px]' : ''
      } inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

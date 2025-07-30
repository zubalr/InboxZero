'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useReducedMotion } from './AccessibilityUtils';

// Fade in animation
export function FadeIn({
  children,
  delay = 0,
  duration = 300,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={`transition-opacity ease-in-out ${className}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transitionDuration: `${duration}ms`,
      }}
    >
      {children}
    </div>
  );
}

// Slide in animation
export function SlideIn({
  children,
  direction = 'up',
  delay = 0,
  duration = 300,
  className = '',
}: {
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  const getTransform = () => {
    if (isVisible) return 'translate3d(0, 0, 0)';

    switch (direction) {
      case 'up':
        return 'translate3d(0, 20px, 0)';
      case 'down':
        return 'translate3d(0, -20px, 0)';
      case 'left':
        return 'translate3d(20px, 0, 0)';
      case 'right':
        return 'translate3d(-20px, 0, 0)';
      default:
        return 'translate3d(0, 20px, 0)';
    }
  };

  return (
    <div
      className={`transition-all ease-out ${className}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: getTransform(),
        transitionDuration: `${duration}ms`,
      }}
    >
      {children}
    </div>
  );
}

// Scale animation
export function ScaleIn({
  children,
  delay = 0,
  duration = 200,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={`transition-all ease-out ${className}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'scale(1)' : 'scale(0.95)',
        transitionDuration: `${duration}ms`,
      }}
    >
      {children}
    </div>
  );
}

// Stagger children animation
export function StaggerChildren({
  children,
  staggerDelay = 50,
  className = '',
}: {
  children: React.ReactNode;
  staggerDelay?: number;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={className}>
      {React.Children.map(children, (child, index) => (
        <FadeIn delay={index * staggerDelay}>{child}</FadeIn>
      ))}
    </div>
  );
}

// Hover scale effect
export function HoverScale({
  children,
  scale = 1.05,
  className = '',
}: {
  children: React.ReactNode;
  scale?: number;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={`transition-transform duration-200 ease-out hover:scale-${Math.round(scale * 100)} ${className}`}
      style={
        {
          '--tw-scale-x': scale,
          '--tw-scale-y': scale,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

// Pulse animation for loading states
export function Pulse({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      className={`${prefersReducedMotion ? '' : 'animate-pulse'} ${className}`}
    >
      {children}
    </div>
  );
}

// Bounce animation for notifications
export function Bounce({
  children,
  trigger,
  className = '',
}: {
  children: React.ReactNode;
  trigger: boolean;
  className?: string;
}) {
  const [shouldBounce, setShouldBounce] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (trigger && !prefersReducedMotion) {
      setShouldBounce(true);
      const timer = setTimeout(() => setShouldBounce(false), 600);
      return () => clearTimeout(timer);
    }
  }, [trigger, prefersReducedMotion]);

  return (
    <div className={`${shouldBounce ? 'animate-bounce' : ''} ${className}`}>
      {children}
    </div>
  );
}

// Shake animation for errors
export function Shake({
  children,
  trigger,
  className = '',
}: {
  children: React.ReactNode;
  trigger: boolean;
  className?: string;
}) {
  const [shouldShake, setShouldShake] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (trigger && !prefersReducedMotion) {
      setShouldShake(true);
      const timer = setTimeout(() => setShouldShake(false), 500);
      return () => clearTimeout(timer);
    }
  }, [trigger, prefersReducedMotion]);

  return (
    <div
      className={`${shouldShake ? 'animate-shake' : ''} ${className}`}
      style={{
        animation: shouldShake
          ? 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both'
          : undefined,
      }}
    >
      {children}
      <style jsx>{`
        @keyframes shake {
          10%,
          90% {
            transform: translate3d(-1px, 0, 0);
          }
          20%,
          80% {
            transform: translate3d(2px, 0, 0);
          }
          30%,
          50%,
          70% {
            transform: translate3d(-4px, 0, 0);
          }
          40%,
          60% {
            transform: translate3d(4px, 0, 0);
          }
        }
      `}</style>
    </div>
  );
}

// Smooth height transition
export function SmoothHeight({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [height, setHeight] = useState<number | 'auto'>('auto');
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (ref.current && !prefersReducedMotion) {
      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          setHeight(entry.contentRect.height);
        }
      });

      resizeObserver.observe(ref.current);
      return () => resizeObserver.disconnect();
    }
  }, [prefersReducedMotion]);

  return (
    <div
      className={`overflow-hidden transition-all duration-300 ease-in-out ${className}`}
      style={{ height: prefersReducedMotion ? 'auto' : height }}
    >
      <div ref={ref}>{children}</div>
    </div>
  );
}

// Progress bar animation
export function ProgressBar({
  progress,
  className = '',
  showPercentage = false,
}: {
  progress: number;
  className?: string;
  showPercentage?: boolean;
}) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) {
      setAnimatedProgress(progress);
      return;
    }

    const timer = setTimeout(() => {
      setAnimatedProgress(progress);
    }, 100);

    return () => clearTimeout(timer);
  }, [progress, prefersReducedMotion]);

  return (
    <div className={`relative ${className}`}>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, animatedProgress))}%` }}
        />
      </div>
      {showPercentage && (
        <span className="absolute right-0 top-3 text-xs text-gray-600">
          {Math.round(animatedProgress)}%
        </span>
      )}
    </div>
  );
}

// Typing indicator animation
export function TypingIndicator({ className = '' }: { className?: string }) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return (
      <div className={`flex items-center space-x-1 ${className}`}>
        <div className="w-2 h-2 bg-gray-400 rounded-full" />
        <div className="w-2 h-2 bg-gray-400 rounded-full" />
        <div className="w-2 h-2 bg-gray-400 rounded-full" />
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      <div
        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
        style={{ animationDelay: '0ms' }}
      />
      <div
        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
        style={{ animationDelay: '150ms' }}
      />
      <div
        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
        style={{ animationDelay: '300ms' }}
      />
    </div>
  );
}

// Notification slide in/out
export function NotificationSlide({
  children,
  isVisible,
  position = 'top-right',
  className = '',
}: {
  children: React.ReactNode;
  isVisible: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      default:
        return 'top-4 right-4';
    }
  };

  const getTransform = () => {
    if (prefersReducedMotion) return 'none';
    if (isVisible) return 'translateX(0)';

    return position.includes('right')
      ? 'translateX(100%)'
      : 'translateX(-100%)';
  };

  return (
    <div
      className={`fixed z-50 transition-all duration-300 ease-in-out ${getPositionClasses()} ${className}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: getTransform(),
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
    >
      {children}
    </div>
  );
}

// Custom hook for intersection observer animations
export function useInViewAnimation(threshold = 0.1) {
  const [isInView, setIsInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isInView };
}

// Animate on scroll component
export function AnimateOnScroll({
  children,
  animation = 'fadeIn',
  threshold = 0.1,
  className = '',
}: {
  children: React.ReactNode;
  animation?: 'fadeIn' | 'slideUp' | 'slideLeft' | 'slideRight' | 'scaleIn';
  threshold?: number;
  className?: string;
}) {
  const { ref, isInView } = useInViewAnimation(threshold);
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  const getAnimationStyles = () => {
    const baseStyle = {
      transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
    };

    if (isInView) {
      return {
        ...baseStyle,
        opacity: 1,
        transform: 'translate3d(0, 0, 0) scale(1)',
      };
    }

    switch (animation) {
      case 'slideUp':
        return {
          ...baseStyle,
          opacity: 0,
          transform: 'translate3d(0, 40px, 0)',
        };
      case 'slideLeft':
        return {
          ...baseStyle,
          opacity: 0,
          transform: 'translate3d(-40px, 0, 0)',
        };
      case 'slideRight':
        return {
          ...baseStyle,
          opacity: 0,
          transform: 'translate3d(40px, 0, 0)',
        };
      case 'scaleIn':
        return {
          ...baseStyle,
          opacity: 0,
          transform: 'scale(0.8)',
        };
      default: // fadeIn
        return {
          ...baseStyle,
          opacity: 0,
        };
    }
  };

  return (
    <div ref={ref} className={className} style={getAnimationStyles()}>
      {children}
    </div>
  );
}

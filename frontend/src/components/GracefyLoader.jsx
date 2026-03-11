import React from 'react';

/**
 * GracefyLoader - A beautiful loading animation featuring
 * a cross at the center with outward radiating sound waves
 */
const GracefyLoader = ({ size = 'default', text = 'Loading...', showText = true }) => {
  const sizeClasses = {
    small: 'w-16 h-16',
    default: 'w-24 h-24',
    large: 'w-32 h-32',
    xlarge: 'w-40 h-40'
  };

  const crossSizes = {
    small: { width: 3, height: 20, horizontal: 14 },
    default: { width: 4, height: 28, horizontal: 20 },
    large: { width: 5, height: 36, horizontal: 26 },
    xlarge: { width: 6, height: 44, horizontal: 32 }
  };

  const cs = crossSizes[size] || crossSizes.default;

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className={`relative ${sizeClasses[size] || sizeClasses.default}`}>
        {/* Sound Wave Rings - Animating outward */}
        <div className="absolute inset-0 flex items-center justify-center">
          {[1, 2, 3, 4].map((ring) => (
            <div
              key={ring}
              className="absolute rounded-full border-2 border-blue-500/60"
              style={{
                animation: `soundWave 2s ease-out infinite`,
                animationDelay: `${(ring - 1) * 0.4}s`,
                width: '30%',
                height: '30%',
              }}
            />
          ))}
        </div>

        {/* Glow effect behind cross */}
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{
            filter: 'blur(8px)',
          }}
        >
          <div className="w-8 h-8 bg-blue-500/40 rounded-full animate-pulse" />
        </div>

        {/* Cross at center */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="relative">
            {/* Vertical bar of cross */}
            <div 
              className="bg-gradient-to-b from-blue-400 via-blue-500 to-blue-600 rounded-full shadow-lg shadow-blue-500/50"
              style={{
                width: `${cs.width}px`,
                height: `${cs.height}px`,
              }}
            />
            {/* Horizontal bar of cross */}
            <div 
              className="absolute bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 rounded-full shadow-lg shadow-blue-500/50"
              style={{
                width: `${cs.horizontal}px`,
                height: `${cs.width}px`,
                top: `${cs.height * 0.25}px`,
                left: `${-(cs.horizontal - cs.width) / 2}px`,
              }}
            />
          </div>
        </div>

        {/* Vertical sound bars on sides */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Left side bars */}
          <div className="absolute left-1 flex items-center gap-0.5">
            {[1, 2, 3].map((bar) => (
              <div
                key={`left-${bar}`}
                className="bg-blue-500/70 rounded-full"
                style={{
                  width: '2px',
                  animation: `soundBar 0.8s ease-in-out infinite`,
                  animationDelay: `${bar * 0.15}s`,
                }}
              />
            ))}
          </div>
          {/* Right side bars */}
          <div className="absolute right-1 flex items-center gap-0.5">
            {[1, 2, 3].map((bar) => (
              <div
                key={`right-${bar}`}
                className="bg-blue-500/70 rounded-full"
                style={{
                  width: '2px',
                  animation: `soundBar 0.8s ease-in-out infinite`,
                  animationDelay: `${bar * 0.15}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Loading text */}
      {showText && (
        <p className="text-blue-400/80 text-sm font-medium tracking-wide animate-pulse">
          {text}
        </p>
      )}

      {/* CSS Keyframes */}
      <style>{`
        @keyframes soundWave {
          0% {
            width: 30%;
            height: 30%;
            opacity: 0.8;
            border-width: 2px;
          }
          100% {
            width: 100%;
            height: 100%;
            opacity: 0;
            border-width: 1px;
          }
        }

        @keyframes soundBar {
          0%, 100% {
            height: 8px;
            opacity: 0.5;
          }
          50% {
            height: 20px;
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

/**
 * Full page loader wrapper
 */
export const PageLoader = ({ text = 'Loading...' }) => (
  <div className="flex items-center justify-center h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
    <GracefyLoader size="large" text={text} />
  </div>
);

/**
 * Inline loader for smaller spaces
 */
export const InlineLoader = ({ text = 'Loading...' }) => (
  <div className="flex items-center justify-center py-8">
    <GracefyLoader size="default" text={text} />
  </div>
);

/**
 * Small loader for buttons or compact spaces
 */
export const SmallLoader = ({ showText = false }) => (
  <GracefyLoader size="small" showText={showText} />
);

export default GracefyLoader;

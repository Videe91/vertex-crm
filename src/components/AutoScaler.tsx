import React, { useEffect, useState } from 'react';

interface AutoScalerProps {
  children: React.ReactNode;
  baseWidth?: number; // Your Mac's screen width as reference
  minScale?: number;
  maxScale?: number;
}

const AutoScaler: React.FC<AutoScalerProps> = ({ 
  children, 
  baseWidth = 1440, // Default Mac screen width
  minScale = 0.6,
  maxScale = 1.4
}) => {
  const [scale, setScale] = useState(1);
  const [screenInfo, setScreenInfo] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const calculateScale = () => {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      
      setScreenInfo({ width: screenWidth, height: screenHeight });
      
      // Calculate scale based on screen width
      let calculatedScale = screenWidth / baseWidth;
      
      // Apply constraints
      calculatedScale = Math.max(minScale, Math.min(maxScale, calculatedScale));
      
      // Special handling for very wide screens (ultrawide monitors)
      if (screenWidth > 2000) {
        calculatedScale = Math.min(calculatedScale, 1.2);
      }
      
      // Special handling for mobile/tablet
      if (screenWidth < 768) {
        calculatedScale = Math.max(0.7, calculatedScale);
      }
      
      setScale(calculatedScale);
      
      // Apply the scale to the root element
      document.documentElement.style.setProperty('--app-scale', calculatedScale.toString());
      
      // Debug info (remove in production)
      console.log(`🔍 Auto-Scaler Debug:
        Screen: ${screenWidth}x${screenHeight}
        Base Width: ${baseWidth}px
        Calculated Scale: ${calculatedScale.toFixed(3)}
        Applied Scale: ${calculatedScale.toFixed(3)}`);
    };

    // Calculate on mount
    calculateScale();

    // Recalculate on resize
    window.addEventListener('resize', calculateScale);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', calculateScale);
    };
  }, [baseWidth, minScale, maxScale]);

  return (
    <div 
      className="scale-smooth"
      style={{
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        width: `${100 / scale}%`,
        height: `${100 / scale}%`,
        overflow: 'hidden'
      }}
    >
      {children}
      
      {/* Debug overlay - remove in production */}
      {import.meta.env.DEV && (
        <div className="fixed top-2 right-2 bg-black/80 text-white text-xs p-2 rounded z-50 pointer-events-none">
          <div>Screen: {screenInfo.width}×{screenInfo.height}</div>
          <div>Scale: {scale.toFixed(3)}</div>
          <div>Base: {baseWidth}px</div>
        </div>
      )}
    </div>
  );
};

export default AutoScaler;

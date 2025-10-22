import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';

// Enhanced TourMascot component with pointing hand
const TourMascot = ({ 
  emotion = 'happy', 
  size = 'md', 
  pointDirection = 'right' 
}: { 
  emotion?: string; 
  size?: 'sm' | 'md' | 'lg';
  pointDirection?: 'right' | 'left' | 'up' | 'down';
}) => {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20'
  };

  return (
    <motion.div
      className={`${sizeClasses[size]} relative`}
      animate={{
        y: [0, -4, 0],
        rotate: emotion === 'excited' ? [0, 5, -5, 0] : 0
      }}
      transition={{
        y: { duration: 2, repeat: Infinity },
        rotate: { duration: 0.5, repeat: Infinity }
      }}
    >
      {/* Main character body */}
      <div className="w-full h-full bg-gradient-to-br from-purple-400 to-pink-500 rounded-full relative overflow-visible border-4 border-white shadow-lg">
        {/* Face */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Eyes */}
          <div className="flex gap-1 items-center">
            <div className={`w-2 h-2 bg-white rounded-full ${emotion === 'winking' ? 'animate-pulse' : ''}`}>
              <div className="w-1 h-1 bg-gray-800 rounded-full m-0.5"></div>
            </div>
            <div className={`w-2 h-2 bg-white rounded-full ${emotion === 'winking' ? 'w-0.5 h-0.5' : ''}`}>
              <div className="w-1 h-1 bg-gray-800 rounded-full m-0.5"></div>
            </div>
          </div>
        </div>
        
        {/* Mouth */}
        <div className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 w-3 h-1.5 ${
          emotion === 'excited' ? 'bg-yellow-300 rounded-full' : 
          emotion === 'happy' ? 'bg-pink-200 rounded-full' : 'bg-gray-300'
        }`}></div>
        
        {/* Sparkles for excitement */}
        {emotion === 'excited' && (
          <>
            <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-yellow-400 animate-pulse" />
            <Sparkles className="absolute -bottom-1 -left-1 w-2 h-2 text-pink-400 animate-pulse" />
          </>
        )}
      </div>
      
      {/* Shadow */}
      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-2 bg-black/10 rounded-full blur-sm"></div>
    </motion.div>
  );
};

// Speech bubble component
const SpeechBubble = ({ children, position = 'right', color = 'purple' }: { 
  children: React.ReactNode; 
  position?: 'left' | 'right'; 
  color?: 'purple' | 'blue' | 'pink' | 'green' 
}) => {
  const colorClasses = {
    purple: 'bg-purple-100 border-purple-300 text-purple-800',
    blue: 'bg-blue-100 border-blue-300 text-blue-800',
    pink: 'bg-pink-100 border-pink-300 text-pink-800',
    green: 'bg-green-100 border-green-300 text-green-800'
  };

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      className={`relative max-w-xs p-4 rounded-2xl border-2 ${colorClasses[color]} shadow-lg`}
    >
      {children}
      
      {/* Speech bubble tail */}
      <div className={`absolute top-1/2 transform -translate-y-1/2 ${
        position === 'right' ? '-left-2' : '-right-2'
      }`}>
        <div className={`w-4 h-4 ${colorClasses[color].split(' ')[0]} border-2 ${colorClasses[color].split(' ')[1]} transform rotate-45`}></div>
      </div>
    </motion.div>
  );
};

interface TourStep {
  element: string;
  intro: string;
}

interface TeenFriendlyTourProps {
  isActive: boolean;
  onClose: () => void;
  steps: TourStep[];
  onComplete?: () => void;
}

// Simplified positioning function
const getHighlightPosition = (targetSelector: string) => {
  const element = document.querySelector(targetSelector);
  if (!element) return { top: 0, left: 0, width: 200, height: 100 };

  const rect = element.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  
  return {
    top: rect.top + scrollTop - 8,
    left: rect.left + scrollLeft - 8,
    width: rect.width + 16,
    height: rect.height + 16
  };
};

// Main TeenFriendlyTour component - SIMPLIFIED VERSION
export const TeenFriendlyTour = ({ 
  isActive, 
  onClose, 
  steps = [], 
  onComplete 
}: TeenFriendlyTourProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [mascotEmotion, setMascotEmotion] = useState('excited');
  const [showIntro, setShowIntro] = useState(true);
  const [highlightPosition, setHighlightPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [mascotPosition, setMascotPosition] = useState({ top: 100, left: 100 });
  const timeoutRef = useRef<NodeJS.Timeout>();

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      setMascotEmotion('excited');
      setTimeout(() => setMascotEmotion('happy'), 1000);
    } else {
      onComplete?.();
      onClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setMascotEmotion('winking');
      setTimeout(() => setMascotEmotion('happy'), 500);
    }
  };

  const skipTour = () => {
    setMascotEmotion('excited');
    setTimeout(() => {
      onClose();
    }, 500);
  };

  // Intro sequence
  useEffect(() => {
    if (isActive && showIntro) {
      setMascotEmotion('excited');
      
      const introTimer = setTimeout(() => {
        setShowIntro(false);
        setMascotEmotion('happy');
      }, 2500);
      
      return () => clearTimeout(introTimer);
    }
  }, [isActive, showIntro]);

  // Handle step changes - SIMPLIFIED
  useEffect(() => {
    if (!showIntro && steps[currentStep]?.element && isActive) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      const targetElement = document.querySelector(steps[currentStep].element);
      if (!targetElement) {
        console.warn(`Tour element not found: ${steps[currentStep].element}`);
        return;
      }

      // Scroll to element
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      });

      // Update positions after scroll
      timeoutRef.current = setTimeout(() => {
        const highlightPos = getHighlightPosition(steps[currentStep].element);
        setHighlightPosition(highlightPos);

        // Simple mascot positioning - to the right of highlight
        const mascotLeft = highlightPos.left + highlightPos.width + 20;
        const mascotTop = highlightPos.top + (highlightPos.height / 2) - 100;
        
        // Keep mascot in viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        const finalLeft = Math.min(mascotLeft, viewportWidth - 400);
        const finalTop = Math.max(scrollTop + 20, Math.min(mascotTop, scrollTop + viewportHeight - 200));
        
        setMascotPosition({ top: finalTop, left: finalLeft });
      }, 800);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentStep, steps, showIntro, isActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!isActive || !steps.length) return null;

  const currentStepData = steps[currentStep];

  return (
    <AnimatePresence>
      {isActive && (
        <>
          {/* Dark overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={skipTour}
          />

          {/* Intro Sequence */}
          {showIntro && typeof window !== 'undefined' && (
            <motion.div
              initial={{ 
                x: -200,
                y: -100,
                scale: 0.5,
                rotate: -45
              }}
              animate={{ 
                x: window.innerWidth / 2 - 200,
                y: window.innerHeight / 2 - 150,
                scale: 1,
                rotate: 0
              }}
              transition={{ 
                duration: 1.5,
                ease: "easeOut",
                type: "spring",
                stiffness: 100,
                damping: 15
              }}
              className="fixed z-50"
            >
              <div className="flex items-start gap-4">
                <div className="relative">
                  <TourMascot 
                    emotion="excited" 
                    size="lg" 
                    pointDirection="right"
                  />
                  
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="absolute -inset-4 pointer-events-none"
                  >
                    <Sparkles className="absolute top-0 left-0 w-4 h-4 text-yellow-400" />
                    <Sparkles className="absolute top-0 right-0 w-3 h-3 text-pink-400" />
                    <Sparkles className="absolute bottom-0 left-0 w-3 h-3 text-blue-400" />
                    <Sparkles className="absolute bottom-0 right-0 w-4 h-4 text-purple-400" />
                  </motion.div>
                </div>
                
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 1, duration: 0.5 }}
                >
                  <SpeechBubble position="right" color="purple">
                    <div className="space-y-2">
                      <div className="font-bold text-sm">
                        Hi there! I'm Sync!
                      </div>
                      <div className="text-sm">
                        I'm here to show you around your awesome learning hub! Ready for the tour?
                      </div>
                    </div>
                  </SpeechBubble>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Element highlight */}
          {!showIntro && (
            <motion.div
              key={`highlight-${currentStep}`}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="fixed z-50 pointer-events-none"
              style={{
                top: highlightPosition.top,
                left: highlightPosition.left,
                width: highlightPosition.width,
                height: highlightPosition.height
              }}
            >
              <div className="relative w-full h-full">
                <div className="absolute inset-0 rounded-lg border-4 border-yellow-400 shadow-xl">
                  <div className="absolute inset-0 bg-yellow-100/10 rounded-lg"></div>
                  <div className="absolute inset-0 border-2 border-yellow-300/60 rounded-lg animate-pulse"></div>
                </div>
                
                {/* Corner markers */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-l-4 border-t-4 border-yellow-500 rounded-tl"></div>
                <div className="absolute -top-1 -right-1 w-4 h-4 border-r-4 border-t-4 border-yellow-500 rounded-tr"></div>
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-l-4 border-b-4 border-yellow-500 rounded-bl"></div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-r-4 border-b-4 border-yellow-500 rounded-br"></div>
              </div>
            </motion.div>
          )}

          {/* Mascot with simple positioning */}
          {!showIntro && (
            <motion.div
              key={`mascot-${currentStep}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3 }}
              className="fixed z-50"
              style={{
                top: mascotPosition.top,
                left: mascotPosition.left
              }}
            >
              <div className="flex items-start gap-4">
                <TourMascot 
                  emotion={mascotEmotion} 
                  size="lg" 
                  pointDirection="left"
                />
                
                <SpeechBubble 
                  position="right" 
                  color={currentStep === 0 ? 'purple' : 
                         currentStep === steps.length - 1 ? 'green' : 'blue'}
                >
                  <div className="space-y-3">
                    <div className="font-bold text-sm">
                      {currentStep === 0 ? "Let's start with your profile!" :
                       currentStep === steps.length - 1 ? "You're all set! Let's boost that learning!" :
                       `Step ${currentStep + 1} of ${steps.length}`}
                    </div>
                    
                    <div className="text-sm leading-relaxed">
                      {currentStepData.intro}
                    </div>
                    
                    {/* Progress dots */}
                    <div className="flex justify-center gap-1">
                      {steps.map((_, index) => (
                        <div
                          key={index}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            index === currentStep ? 'bg-purple-500' :
                            index < currentStep ? 'bg-green-400' : 'bg-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    
                    {/* Navigation buttons */}
                    <div className="flex justify-between items-center">
                      <button
                        onClick={prevStep}
                        disabled={currentStep === 0}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          currentStep === 0 
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-white text-purple-600 hover:bg-purple-50 border border-purple-200'
                        }`}
                      >
                        <ChevronLeft className="w-3 h-3" />
                        Back
                      </button>
                      
                      <button
                        onClick={skipTour}
                        className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        Skip Tour
                      </button>
                      
                      <button
                        onClick={nextStep}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-purple-500 text-white hover:bg-purple-600 transition-colors"
                      >
                        {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                        {currentStep === steps.length - 1 ? (
                          <Sparkles className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </SpeechBubble>
              </div>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
};
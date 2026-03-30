import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TrafficLoadingProps {
  isSuccess: boolean;
  onComplete?: () => void;
}

const TrafficLoading: React.FC<TrafficLoadingProps> = ({ isSuccess, onComplete }) => {
  const [carLeft, setCarLeft] = useState(false);

  useEffect(() => {
    if (isSuccess) {
      // Wait a brief moment after success for the light to turn green, then speed off
      const timer = setTimeout(() => {
        setCarLeft(true);
      }, 1200); // 增加绿灯亮起到车子启动的等待时间 (原来是 600)
      return () => clearTimeout(timer);
    } else {
      setCarLeft(false);
    }
  }, [isSuccess]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050b14] overflow-hidden font-mono"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 1 } }}
      >
        {/* Glowing Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.05)_0%,transparent_70%)] pointer-events-none" />

        {/* Status Text */}
        <motion.div
          className={`relative z-10 text-2xl md:text-4xl font-bold tracking-widest mb-20 ${
            isSuccess ? 'text-green-400' : 'text-cyan-400'
          }`}
          animate={{ opacity: isSuccess ? 1 : [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: isSuccess ? 0 : Infinity }}
          style={{
            textShadow: isSuccess
              ? '0 0 15px rgba(74, 222, 128, 0.8)'
              : '0 0 15px rgba(34, 211, 238, 0.8)',
          }}
        >
          {isSuccess ? 'ACCESS GRANTED' : 'AUTHENTICATING...'}
        </motion.div>

        {/* Scene Container */}
        <div className="relative w-full max-w-5xl h-64 flex items-end justify-center">
          
          {/* Traffic Light */}
          <div className="absolute bottom-32 right-[25%] w-10 h-28 bg-gray-900 rounded-xl border border-cyan-900/50 flex flex-col items-center justify-between py-3 shadow-[0_0_20px_rgba(0,0,0,0.8)] z-20">
            {/* Red Light */}
            <motion.div
              className="w-6 h-6 rounded-full bg-red-500"
              animate={{
                opacity: isSuccess ? 0.2 : 1,
                boxShadow: isSuccess ? 'none' : '0 0 15px 4px rgba(239, 68, 68, 0.8)',
              }}
              transition={{ duration: 0.3 }}
            />
            {/* Green Light */}
            <motion.div
              className="w-6 h-6 rounded-full bg-green-500"
              animate={{
                opacity: isSuccess ? 1 : 0.2,
                boxShadow: isSuccess ? '0 0 15px 4px rgba(34, 197, 94, 0.8)' : 'none',
              }}
              transition={{ duration: 0.3 }}
            />
          </div>
          
          {/* Traffic Light Pole */}
          <div className="absolute bottom-0 right-[25%] translate-x-[18px] w-1 h-32 bg-gray-800 border-l border-cyan-900/30 z-10" />

          {/* Road Base */}
          <div className="absolute bottom-0 w-[200vw] h-1 bg-cyan-900/40 shadow-[0_0_10px_rgba(34,211,238,0.2)]" />
          
          {/* Road Dashed Line */}
          <div className="absolute bottom-0 w-[200vw] flex justify-around opacity-30">
            {[...Array(30)].map((_, i) => (
              <div key={i} className="w-12 h-1 bg-cyan-400" />
            ))}
          </div>

          {/* Stop Line */}
          <div className="absolute bottom-0 right-[30%] w-3 h-20 bg-cyan-200/80 shadow-[0_0_15px_rgba(34,211,238,0.6)] skew-x-[-45deg] origin-bottom" />

          {/* Tech Car */}
          <motion.div
            className="absolute bottom-1 right-[30%] mr-12 z-30"
            initial={{ x: -200, opacity: 0 }}
            animate={
              carLeft
                ? { x: '150vw', opacity: 1 }
                : {
                    x: 0,
                    opacity: 1,
                    y: isSuccess ? 0 : [0, -1.5, 0],
                  }
            }
            transition={
              carLeft
                ? { duration: 1.5, ease: 'easeIn' } // 增加车子开出屏幕的时间 (原来是 0.8)
                : {
                    y: { duration: 0.08, repeat: Infinity, repeatType: 'reverse' },
                    x: { duration: 1, ease: 'easeOut' },
                  }
            }
            onAnimationComplete={() => {
              if (carLeft && onComplete) {
                // 车子开出屏幕后，再稍微等一下再跳转，避免太突兀
                setTimeout(() => {
                  onComplete();
                }, 400);
              }
            }}
          >
            <svg
              width="220"
              height="70"
              viewBox="0 0 220 70"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Underglow */}
              <ellipse
                cx="110"
                cy="65"
                rx="90"
                ry="5"
                fill="#22d3ee"
                opacity="0.35"
                filter="blur(6px)"
              />
              
              {/* Car Body Base */}
              <path
                d="M25 55 L15 35 L50 20 L130 20 L180 35 L205 55 Z"
                fill="#0f172a"
                stroke="#22d3ee"
                strokeWidth="2"
              />
              
              {/* Car Body Top/Windows */}
              <path
                d="M55 22 L125 22 L160 35 L45 35 Z"
                fill="#083344"
                stroke="#06b6d4"
                strokeWidth="1.5"
                opacity="0.9"
              />
              
              {/* Cyber Lines */}
              <path d="M50 45 L180 45" stroke="#06b6d4" strokeWidth="1" opacity="0.5" />
              <path d="M130 20 L145 35" stroke="#06b6d4" strokeWidth="1" opacity="0.5" />
              <path d="M50 20 L40 35" stroke="#06b6d4" strokeWidth="1" opacity="0.5" />

              {/* Rear Wheel */}
              <circle cx="50" cy="55" r="12" fill="#020617" stroke="#22d3ee" strokeWidth="2" />
              <circle cx="50" cy="55" r="4" fill="#22d3ee" />
              <path d="M50 43 L50 47 M50 63 L50 67 M38 55 L42 55 M58 55 L62 55" stroke="#22d3ee" strokeWidth="1.5" />

              {/* Front Wheel */}
              <circle cx="160" cy="55" r="12" fill="#020617" stroke="#22d3ee" strokeWidth="2" />
              <circle cx="160" cy="55" r="4" fill="#22d3ee" />
              <path d="M160 43 L160 47 M160 63 L160 67 M148 55 L152 55 M172 55 L176 55" stroke="#22d3ee" strokeWidth="1.5" />

              {/* Headlight */}
              <path
                d="M195 42 L210 42 L205 50 L195 50 Z"
                fill="#ffffff"
                filter="drop-shadow(0 0 8px #ffffff)"
              />
              <path
                d="M210 44 L250 44 L250 48 L205 48 Z"
                fill="url(#headlight-beam)"
                opacity="0.6"
              />

              {/* Taillight */}
              <path
                d="M20 42 L10 42 L15 50 L20 50 Z"
                fill="#ef4444"
                filter="drop-shadow(0 0 8px #ef4444)"
              />

              {/* Gradients */}
              <defs>
                <linearGradient id="headlight-beam" x1="210" y1="46" x2="250" y2="46" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#ffffff" stopOpacity="0.8" />
                  <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TrafficLoading;

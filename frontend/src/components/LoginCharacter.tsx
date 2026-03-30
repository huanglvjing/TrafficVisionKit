import { motion, useSpring } from 'framer-motion'
import { useEffect, useState } from 'react'

export interface LoginCharacterProps {
  isPasswordFocused: boolean
  isUsernameFocused: boolean
  usernameLength: number
}

export function LoginCharacter({
  isPasswordFocused,
  isUsernameFocused,
  usernameLength,
}: LoginCharacterProps) {
  // Mouse tracking state
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Normalize mouse position relative to the center of the screen (-1 to 1)
      const x = (e.clientX / window.innerWidth - 0.5) * 2
      const y = (e.clientY / window.innerHeight - 0.5) * 2
      setMousePos({ x, y })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  // Smooth springs for eye movement
  const eyeX = useSpring(0, { stiffness: 300, damping: 20 })
  const eyeY = useSpring(0, { stiffness: 300, damping: 20 })
  // Parallax for the screen
  const screenX = useSpring(0, { stiffness: 300, damping: 20 })
  const screenY = useSpring(0, { stiffness: 300, damping: 20 })
  // Parallax for the body
  const bodyX = useSpring(0, { stiffness: 300, damping: 20 })
  const bodyY = useSpring(0, { stiffness: 300, damping: 20 })

  useEffect(() => {
    if (isPasswordFocused) {
      eyeX.set(0)
      eyeY.set(0)
      screenX.set(0)
      screenY.set(0)
      bodyX.set(0)
      bodyY.set(0)
    } else if (isUsernameFocused) {
      // Look right (towards the login form) and slightly down
      // Add a little movement based on how much they've typed
      const typingOffset = Math.min(usernameLength * 1.5, 15)
      eyeX.set(15 + typingOffset) // Look right
      eyeY.set(8) // Look slightly down
      screenX.set((15 + typingOffset) * 0.4)
      screenY.set(8 * 0.4)
      bodyX.set((15 + typingOffset) * 0.15)
      bodyY.set(8 * 0.15)
    } else {
      // Follow mouse
      eyeX.set(mousePos.x * 18)
      eyeY.set(mousePos.y * 12)
      screenX.set(mousePos.x * 8)
      screenY.set(mousePos.y * 5)
      bodyX.set(mousePos.x * 3)
      bodyY.set(mousePos.y * 2)
    }
  }, [isPasswordFocused, isUsernameFocused, usernameLength, mousePos, eyeX, eyeY, screenX, screenY, bodyX, bodyY])

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <motion.svg
        width="100%"
        height="100%"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        {/* Ground and Vehicle */}
        <g opacity="0.6">
          <line x1="10" y1="180" x2="190" y2="180" stroke="#00D4FF" strokeWidth="1" strokeDasharray="2 4" />
          <line x1="10" y1="185" x2="190" y2="185" stroke="#00D4FF" strokeWidth="1" strokeDasharray="10 10" opacity="0.3" />
          <motion.g
            animate={{ x: [-40, 220] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          >
            {/* Sleeker Vehicle */}
            <path d="M 0 176 L 12 176 L 16 180 L -4 180 Z" fill="rgba(0,212,255,0.4)" stroke="#00D4FF" strokeWidth="1" />
            <circle cx="2" cy="180" r="1.5" fill="#00D4FF" />
            <circle cx="12" cy="180" r="1.5" fill="#00D4FF" />
            {/* Vehicle Trail */}
            <line x1="-20" y1="178" x2="-4" y2="178" stroke="#00D4FF" strokeWidth="1" opacity="0.5" />
          </motion.g>
        </g>

        {/* Drone Body Hover Animation */}
        <motion.g
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* Scanner Beam */}
          <motion.polygon
            fill="url(#scanner-grad)"
            opacity="0.3"
            animate={
              isUsernameFocused 
                ? { points: "100,140 120,180 200,180" } // Point right
                : { points: [
                    "100,140 20,180 140,180", 
                    "100,140 60,180 180,180", 
                    "100,140 20,180 140,180"
                  ] } // Sweep back and forth
            }
            transition={
              isUsernameFocused 
                ? { duration: 0.5 }
                : { duration: 4, repeat: Infinity, ease: "easeInOut" }
            }
          />

          <defs>
            <linearGradient id="scanner-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#00D4FF" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#00D4FF" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Main Body - More spherical/sleek */}
          <motion.g style={{ x: bodyX, y: bodyY }}>
            <circle cx="100" cy="100" r="45" fill="rgba(15,22,40,0.85)" stroke="#00D4FF" strokeWidth="2" />
            <circle cx="100" cy="100" r="35" fill="rgba(0,212,255,0.05)" stroke="#00D4FF" strokeWidth="1" strokeDasharray="4 4" />
            
            {/* Antenna */}
            <line x1="100" y1="55" x2="100" y2="35" stroke="#00D4FF" strokeWidth="2" />
            <motion.circle
              cx="100"
              cy="35"
              r="4"
              fill="#00D4FF"
              animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.3, 1] }}
              transition={{ 
                duration: isUsernameFocused ? 0.4 : 1.5, 
                repeat: Infinity 
              }}
              style={{ filter: 'drop-shadow(0 0 6px #00D4FF)' }}
            />
          </motion.g>

          {/* Eye Screen */}
          <motion.rect
            x="65"
            y="85"
            width="70"
            height="30"
            rx="15"
            fill="rgba(0,212,255,0.15)"
            stroke="#00D4FF"
            strokeWidth="2"
            style={{ x: screenX, y: screenY }}
          />

          {/* Eyes */}
          <motion.g style={{ x: eyeX, y: eyeY }}>
            {/* Left Eye */}
            <motion.circle
              cx="85"
              cy="100"
              r="7"
              fill="#00D4FF"
              style={{ filter: 'drop-shadow(0 0 5px #00D4FF)' }}
              animate={{
                scaleY: isPasswordFocused ? 0.1 : 1,
                opacity: isPasswordFocused ? 0.3 : 1
              }}
              transition={{ duration: 0.2 }}
            />
            {/* Right Eye */}
            <motion.circle
              cx="115"
              cy="100"
              r="7"
              fill="#00D4FF"
              style={{ filter: 'drop-shadow(0 0 5px #00D4FF)' }}
              animate={{
                scaleY: isPasswordFocused ? 0.1 : 1,
                opacity: isPasswordFocused ? 0.3 : 1
              }}
              transition={{ duration: 0.2 }}
            />
          </motion.g>

          {/* Password Covering Shields (Mechanical Iris/Plates) */}
          <motion.g
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ 
              opacity: isPasswordFocused ? 1 : 0, 
              scaleY: isPasswordFocused ? 1 : 0,
            }}
            style={{ originY: 0.5 }}
            transition={{ duration: 0.3, type: 'spring', stiffness: 200, damping: 15 }}
          >
            {/* Top Plate */}
            <path d="M 65 100 L 135 100 C 135 85, 65 85, 65 100 Z" fill="rgba(15,22,40,0.95)" stroke="#00D4FF" strokeWidth="2" />
            {/* Bottom Plate */}
            <path d="M 65 100 L 135 100 C 135 115, 65 115, 65 100 Z" fill="rgba(15,22,40,0.95)" stroke="#00D4FF" strokeWidth="2" />
            <line x1="65" y1="100" x2="135" y2="100" stroke="#00D4FF" strokeWidth="2" />
          </motion.g>

          {/* Side Thrusters */}
          <path d="M 55 115 L 45 130 L 60 130 Z" fill="none" stroke="#00D4FF" strokeWidth="2" />
          <path d="M 145 115 L 155 130 L 140 130 Z" fill="none" stroke="#00D4FF" strokeWidth="2" />
          
          <motion.circle cx="52" cy="132" r="3" fill="#00D4FF" animate={{ opacity: [0.2, 1, 0.2], y: [0, 4, 0] }} transition={{ duration: 0.3, repeat: Infinity }} style={{ filter: 'drop-shadow(0 0 4px #00D4FF)' }} />
          <motion.circle cx="148" cy="132" r="3" fill="#00D4FF" animate={{ opacity: [0.2, 1, 0.2], y: [0, 4, 0] }} transition={{ duration: 0.3, repeat: Infinity, delay: 0.1 }} style={{ filter: 'drop-shadow(0 0 4px #00D4FF)' }} />
        </motion.g>
      </motion.svg>
    </div>
  )
}

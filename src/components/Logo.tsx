import React from 'react'
import logoIcon from '../assets/logos/logo.png'

interface LogoProps {
  isDarkMode: boolean
}

const Logo: React.FC<LogoProps> = ({ isDarkMode }) => {
  return (
    <div className={`fixed top-6 left-6 z-40 transition-all duration-300 ${
      isDarkMode ? 'drop-shadow-2xl' : 'drop-shadow-xl'
    }`}>
      <img 
        src={logoIcon} 
        alt="VERTEX CRM" 
        className="w-16 h-16 object-contain transition-all duration-300 hover:scale-105"
      />
    </div>
  )
}

export default Logo

import { useState, useEffect } from 'react';

export default function useDeviceType() {
  const [deviceType, setDeviceType] = useState('mobile');

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const isTV = ua.includes('tv') || ua.includes('firetv') || ua.includes('android tv')
      || window.innerWidth >= 960;
    setDeviceType(isTV ? 'tv' : 'mobile');
  }, []);

  return deviceType;
}

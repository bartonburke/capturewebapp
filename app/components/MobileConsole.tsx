'use client';

import { useEffect } from 'react';

export default function MobileConsole() {
  useEffect(() => {
    // Only load Eruda in development and on mobile
    if (process.env.NODE_ENV === 'development') {
      import('eruda').then(eruda => {
        eruda.default.init();
        console.log('📱 Mobile console enabled - tap floating button to view logs');
      });
    }
  }, []);

  return null;
}

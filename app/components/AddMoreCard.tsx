'use client';

import { useState } from 'react';

export default function AddMoreCard() {
  const [showToast, setShowToast] = useState(false);

  const handleClick = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="relative flex-shrink-0 w-24 h-28 rounded-2xl
          border-2 border-dashed border-white/30
          flex flex-col items-center justify-center gap-1.5
          transition-all duration-150 active:scale-95 hover:border-white/50
          snap-start bg-white/5"
      >
        {/* Plus icon */}
        <span className="text-2xl text-white/50">+</span>

        {/* Label */}
        <span className="text-xs font-medium text-white/50">
          Add
        </span>
      </button>

      {/* Toast notification */}
      {showToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50
          px-4 py-2 rounded-full bg-gray-800/90 backdrop-blur-sm
          text-sm text-white shadow-lg animate-fade-in">
          Coming soon
        </div>
      )}
    </>
  );
}

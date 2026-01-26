'use client';

interface MapPlaceholderProps {
  photoCount: number;
  gpsCount: number;
}

export default function MapPlaceholder({ photoCount, gpsCount }: MapPlaceholderProps) {
  return (
    <div className="h-full w-full bg-gray-800 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Map pin icon */}
      <svg
        className="w-16 h-16 text-gray-500 mb-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>

      <p className="text-gray-400 text-sm font-medium mb-1">Map view coming soon</p>

      {photoCount > 0 && (
        <p className="text-gray-500 text-xs">
          {gpsCount > 0
            ? `${gpsCount} of ${photoCount} photos with GPS data`
            : `${photoCount} photos (no GPS data)`
          }
        </p>
      )}

      {/* Decorative pins */}
      {gpsCount > 0 && (
        <>
          <div className="absolute top-[25%] left-[30%]">
            <div className="w-3 h-3 bg-blue-500 rounded-full opacity-40" />
          </div>
          <div className="absolute top-[35%] left-[60%]">
            <div className="w-3 h-3 bg-blue-500 rounded-full opacity-30" />
          </div>
          <div className="absolute top-[55%] left-[45%]">
            <div className="w-3 h-3 bg-blue-500 rounded-full opacity-50" />
          </div>
        </>
      )}
    </div>
  );
}

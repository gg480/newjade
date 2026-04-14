'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageLightboxProps {
  images: { id: number; url: string; isCover?: boolean }[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

export default function ImageLightbox({ images, initialIndex = 0, open, onClose }: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loaded, setLoaded] = useState<Set<number>>(new Set());

  const goNext = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex(i => (i + 1) % images.length);
  }, [images.length]);

  const goPrev = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex(i => (i - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, goNext, goPrev]);

  // Touch swipe support
  const [touchStart, setTouchStart] = useState<number | null>(null);
  function handleTouchStart(e: React.TouchEvent) {
    setTouchStart(e.touches[0].clientX);
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStart === null) return;
    const diff = e.changedTouches[0].clientX - touchStart;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goPrev();
      else goNext();
    }
    setTouchStart(null);
  }

  if (!open || images.length === 0) return null;

  const currentImage = images[currentIndex];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Close button */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-4 right-4 z-10 text-white hover:bg-white/20 h-10 w-10 rounded-full"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>

      {/* Counter */}
      <div className="absolute top-4 left-4 z-10 text-white/80 text-sm font-mono bg-black/50 px-3 py-1 rounded-full">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Prev button */}
      {images.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20 h-12 w-12 rounded-full"
          onClick={e => { e.stopPropagation(); goPrev(); }}
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
      )}

      {/* Image */}
      <div
        className="max-w-[90vw] max-h-[85vh] flex items-center justify-center"
        onClick={e => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {!loaded.has(currentIndex) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-8 w-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
        <img
          src={currentImage?.url}
          alt={`货品图片 ${currentIndex + 1}`}
          className={`max-w-full max-h-[85vh] object-contain transition-opacity duration-300 ${loaded.has(currentIndex) ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(prev => new Set(prev).add(currentIndex))}
          onError={e => { (e.target as HTMLImageElement).src = ''; }}
        />
      </div>

      {/* Next button */}
      {images.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20 h-12 w-12 rounded-full"
          onClick={e => { e.stopPropagation(); goNext(); }}
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      )}

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-black/60 rounded-xl px-3 py-2"
          onClick={e => e.stopPropagation()}
        >
          {images.map((img, idx) => (
            <button
              key={img.id}
              className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                idx === currentIndex
                  ? 'border-white scale-110 shadow-lg'
                  : 'border-white/30 opacity-60 hover:opacity-100'
              }`}
              onClick={() => setCurrentIndex(idx)}
            >
              <img src={img.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

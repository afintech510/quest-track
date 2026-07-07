import { useState, useCallback, useEffect, useRef } from 'react';

export default function useSpatialNav() {
  const [focusIndex, setFocusIndex] = useState(0);
  const focusMemory = useRef({});

  const getElements = useCallback(() => {
    return Array.from(document.querySelectorAll('.tv-focusable:not([disabled])'));
  }, []);

  const moveSelection = useCallback((direction) => {
    const elements = getElements();
    if (elements.length === 0) return;

    const safeIndex = Math.min(focusIndex, elements.length - 1);
    const current = elements[safeIndex]?.getBoundingClientRect();
    if (!current) return;

    const cx = current.left + current.width / 2;
    const cy = current.top + current.height / 2;

    let bestIndex = -1;
    let bestScore = Infinity;

    elements.forEach((el, i) => {
      if (i === safeIndex) return;
      const r = el.getBoundingClientRect();
      const dx = (r.left + r.width / 2) - cx;
      const dy = (r.top + r.height / 2) - cy;

      let valid = false;
      if (direction === 'ArrowUp' && dy < -5) valid = true;
      if (direction === 'ArrowDown' && dy > 5) valid = true;
      if (direction === 'ArrowLeft' && dx < -5) valid = true;
      if (direction === 'ArrowRight' && dx > 5) valid = true;

      if (valid) {
        const score = (direction === 'ArrowLeft' || direction === 'ArrowRight')
          ? Math.abs(dx) + 1.8 * Math.abs(dy)
          : 1.8 * Math.abs(dx) + Math.abs(dy);
        if (score < bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }
    });

    if (bestIndex !== -1) {
      setFocusIndex(bestIndex);
      elements[bestIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [focusIndex, getElements]);

  useEffect(() => {
    const handler = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
        e.preventDefault();
        if (e.key === 'Enter') {
          const elements = getElements();
          const safeIndex = Math.min(focusIndex, elements.length - 1);
          elements[safeIndex]?.click();
        } else {
          moveSelection(e.key);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusIndex, moveSelection, getElements]);

  useEffect(() => {
    const elements = getElements();
    if (elements.length === 0) return;
    const safeIndex = Math.min(focusIndex, elements.length - 1);
    if (safeIndex !== focusIndex) setFocusIndex(safeIndex);

    elements.forEach((el, i) => {
      if (i === safeIndex) {
        el.setAttribute('data-focused', 'true');
        el.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-surface-dark');
      } else {
        el.removeAttribute('data-focused');
        el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-surface-dark');
      }
    });
  }, [focusIndex, getElements]);

  const saveFocusMemory = useCallback((profileId) => {
    focusMemory.current[profileId] = focusIndex;
  }, [focusIndex]);

  const restoreFocusMemory = useCallback((profileId) => {
    const saved = focusMemory.current[profileId];
    if (saved !== undefined) {
      setFocusIndex(saved);
    } else {
      setFocusIndex(0);
    }
  }, []);

  return { focusIndex, setFocusIndex, focusMemory, saveFocusMemory, restoreFocusMemory, moveSelection };
}

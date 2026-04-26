'use client';
import { useEffect } from 'react';

export default function KeyboardNav() {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'];
      if (!keys.includes(e.key)) return;

      const active = document.activeElement;
      const items = Array.from(document.querySelectorAll('.nav-item'));
      
      if (!items.length) return;

      // If nothing is focused, focus the first item on any arrow key
      if (!active || !items.includes(active)) {
        if (e.key.startsWith('Arrow')) {
          items[0].focus();
          e.preventDefault();
        }
        return;
      }

      if (e.key === 'Enter') {
        // Let the browser handle Enter on links
        return;
      }

      e.preventDefault();

      const activeRect = active.getBoundingClientRect();
      const activeCenter = {
        x: activeRect.left + activeRect.width / 2,
        y: activeRect.top + activeRect.height / 2
      };

      let bestItem = null;
      let bestDistance = Infinity;

      items.forEach(item => {
        if (item === active) return;

        const rect = item.getBoundingClientRect();
        const center = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        };

        const dx = center.x - activeCenter.x;
        const dy = center.y - activeCenter.y;

        let isCorrectDirection = false;
        
        // Basic directional check
        if (e.key === 'ArrowUp') isCorrectDirection = dy < -10 && Math.abs(dx) < Math.abs(dy) * 2;
        if (e.key === 'ArrowDown') isCorrectDirection = dy > 10 && Math.abs(dx) < Math.abs(dy) * 2;
        if (e.key === 'ArrowLeft') isCorrectDirection = dx < -10 && Math.abs(dy) < Math.abs(dx) * 2;
        if (e.key === 'ArrowRight') isCorrectDirection = dx > 10 && Math.abs(dy) < Math.abs(dx) * 2;

        if (isCorrectDirection) {
          // Weighted distance (prefer same row/column)
          const distance = e.key.startsWith('ArrowLeft') || e.key.startsWith('ArrowRight')
            ? Math.abs(dx) + Math.abs(dy) * 3 // Prefer horizontal
            : Math.abs(dy) + Math.abs(dx) * 3; // Prefer vertical

          if (distance < bestDistance) {
            bestDistance = distance;
            bestItem = item;
          }
        }
      });

      if (bestItem) {
        bestItem.focus();
        bestItem.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return null; // This is a utility component
}

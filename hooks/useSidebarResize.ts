"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface UseSidebarResizeProps {
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

/**
 * Hook to manage sidebar resizing with drag handle
 * Handles mouse events for smooth resizing with constraints
 */
export function useSidebarResize({
  initialWidth = 256,
  minWidth = 200,
  maxWidth = 600,
}: UseSidebarResizeProps = {}) {
  const [sidebarWidth, setSidebarWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(initialWidth);

  /**
   * Start resizing when mouse down on resize handle
   */
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  /**
   * Handle mouse move and mouse up events for resizing
   */
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current;
      const newWidth = startWidthRef.current + delta;

      // Constrain width between min and max
      const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      setSidebarWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
    };

    // Set cursor for resizing
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    
    // Attach event listeners
    document.addEventListener("mousemove", handleMouseMove, { passive: false });
    document.addEventListener("mouseup", handleMouseUp, { passive: false });

    // Cleanup
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, minWidth, maxWidth]);

  /**
   * Reset sidebar width (useful when toggling visibility)
   */
  const resetWidth = useCallback(() => {
    setSidebarWidth(initialWidth);
  }, [initialWidth]);

  return {
    sidebarWidth,
    setSidebarWidth,
    isResizing,
    handleMouseDown,
    resetWidth,
  };
}


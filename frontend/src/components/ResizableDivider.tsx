/**
 * Resizable Divider Component
 * 
 * Horizontal draggable divider to resize two vertically stacked zones.
 */

import { useState, useRef, useEffect, useCallback } from 'react';

interface ResizableDividerProps {
    onResize?: (topHeight: number, bottomHeight: number) => void;
    onResizeEnd?: (topHeight: number, bottomHeight: number) => void;
    minTopHeight?: number;
    minBottomHeight?: number;
    containerHeight: number;
    initialTopHeight: number;
}

export function ResizableDivider({
    onResize,
    onResizeEnd,
    minTopHeight = 100,
    minBottomHeight = 100,
    containerHeight,
    initialTopHeight,
}: ResizableDividerProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [topHeight, setTopHeight] = useState(initialTopHeight);
    const dividerRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!isDragging) return;

            const divider = dividerRef.current;
            if (!divider) return;

            const container = divider.parentElement;
            if (!container) return;

            const containerRect = container.getBoundingClientRect();
            // Calculate relative to the container
            const newTopHeight = e.clientY - containerRect.top;

            // We don't really need bottomHeight for the style, but we calculate it for the callback
            // Note: containerHeight prop might be 0 or stale, so we use current rect
            const currentContainerHeight = containerRect.height;
            const newBottomHeight = currentContainerHeight - newTopHeight;

            // Enforce min heights
            if (newTopHeight >= minTopHeight && newBottomHeight >= minBottomHeight) {
                setTopHeight(newTopHeight);
                if (onResize) {
                    onResize(newTopHeight, newBottomHeight);
                }
            }
        },
        [isDragging, minTopHeight, minBottomHeight, onResize]
    );

    const handleMouseUp = useCallback(() => {
        if (isDragging) {
            setIsDragging(false);
            if (dividerRef.current && dividerRef.current.parentElement && onResizeEnd) {
                const containerHeight = dividerRef.current.parentElement.getBoundingClientRect().height;
                const bottomHeight = containerHeight - topHeight;
                onResizeEnd(topHeight, bottomHeight);
            }
        }
    }, [isDragging, topHeight, onResizeEnd]);

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    return (
        <div
            ref={dividerRef}
            onMouseDown={handleMouseDown}
            className={`
        h-1 bg-slate-300 dark:bg-slate-600
        hover:bg-blue-400 dark:hover:bg-blue-500
        cursor-row-resize
        transition-colors
        flex-shrink-0
        nodrag
        ${isDragging ? 'bg-blue-500 dark:bg-blue-400' : ''}
      `}
            style={{
                position: 'relative',
                zIndex: 10,
            }}
        >
            <div className="absolute inset-x-0 -top-1 -bottom-1 flex items-center justify-center">
                <div className="w-12 h-1 bg-slate-400 dark:bg-slate-500 rounded-full" />
            </div>
        </div>
    );
}

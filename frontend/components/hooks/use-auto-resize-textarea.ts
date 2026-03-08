import { useEffect, useRef, useCallback } from "react";

interface UseAutoResizeTextareaProps {
    minHeight: number;
    maxHeight?: number;
}

export function useAutoResizeTextarea({
    minHeight,
    maxHeight,
}: UseAutoResizeTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = useCallback((reset?: boolean) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        if (reset) {
            textarea.style.height = `${minHeight}px`;
            return;
        }

        textarea.style.height = `${minHeight}px`;
        const scrollHeight = textarea.scrollHeight;

        if (maxHeight && scrollHeight > maxHeight) {
            textarea.style.height = `${maxHeight}px`;
            textarea.style.overflowY = "auto";
        } else {
            textarea.style.height = `${Math.max(scrollHeight, minHeight)}px`;
            textarea.style.overflowY = "hidden";
        }
    }, [minHeight, maxHeight]);

    useEffect(() => {
        adjustHeight();
    }, [adjustHeight]);

    return { textareaRef, adjustHeight };
}

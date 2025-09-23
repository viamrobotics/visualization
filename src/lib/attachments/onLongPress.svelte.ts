import type { Attachment } from "svelte/attachments";

interface LongPressOptions {
    duration?: number;
    onlongpress?: (e: MouseEvent) => void;
}

const longpress = (options: LongPressOptions): Attachment => {
    return (element) => {
        const duration = options.duration || 1000;
        let timer: ReturnType<typeof setTimeout>;

        function handleMouseDown(e: MouseEvent) {
            timer = setTimeout(() => {
                element.dispatchEvent(e);
                options.onlongpress?.(e);
            }, duration)
        }
        function handleMouseUp() {
            clearTimeout(timer);
        }

        element.addEventListener('mousedown', handleMouseDown as EventListener);
        element.addEventListener('mouseup', handleMouseUp);

        return () => {
            clearTimeout(timer);
            element.removeEventListener('mousedown', handleMouseDown as EventListener);
            element.removeEventListener('mouseup', handleMouseUp);
        }
    }
}

export default longpress;
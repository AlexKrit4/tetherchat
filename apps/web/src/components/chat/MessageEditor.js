import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { useAutoResize } from '@/hooks/useAutoResize';
/** Inline editor shown in place of a message body while editing. */
export function MessageEditor({ initialValue, onSubmit, onCancel }) {
    const [value, setValue] = useState(initialValue);
    const ref = useRef(null);
    useAutoResize(ref, value, 400);
    useEffect(() => {
        const node = ref.current;
        if (!node)
            return;
        node.focus();
        node.setSelectionRange(node.value.length, node.value.length);
    }, []);
    return (_jsxs("div", { className: "mt-1 flex flex-col gap-1.5", children: [_jsx("textarea", { ref: ref, value: value, rows: 1, onChange: (event) => setValue(event.target.value), onKeyDown: (event) => {
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        onCancel();
                    }
                    if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        const trimmed = value.trim();
                        if (trimmed)
                            onSubmit(trimmed);
                    }
                }, className: "w-full resize-none rounded-lg bg-base-input px-3 py-2.5 text-message text-text outline-none" }), _jsxs("p", { className: "text-xs text-text-muted", children: ["escape to", ' ', _jsx("button", { type: "button", onClick: onCancel, className: "text-text-link hover:underline", children: "cancel" }), ' ', "\u00B7 enter to", ' ', _jsx("button", { type: "button", onClick: () => value.trim() && onSubmit(value.trim()), className: "text-text-link hover:underline", children: "save" })] })] }));
}
//# sourceMappingURL=MessageEditor.js.map
import typography from '@tailwindcss/typography';
/**
 * Every colour is a CSS variable defined in src/styles/tokens.css. Tailwind's
 * default palette is deliberately dropped so a stray `bg-slate-800` cannot leak
 * into the UI and break the surface hierarchy.
 */
const config = {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: {
        screens: {
            xs: '480px',
            sm: '640px',
            md: '768px',
            lg: '1024px',
            xl: '1280px',
            '2xl': '1536px',
        },
        colors: {
            transparent: 'transparent',
            current: 'currentColor',
            inherit: 'inherit',
            white: '#ffffff',
            black: '#000000',
            base: {
                DEFAULT: 'var(--bg-primary)',
                secondary: 'var(--bg-secondary)',
                tertiary: 'var(--bg-tertiary)',
                floating: 'var(--bg-floating)',
                input: 'var(--input-bg)',
                overlay: 'var(--bg-overlay)',
            },
            surface: {
                hover: 'var(--bg-modifier-hover)',
                active: 'var(--bg-modifier-active)',
                selected: 'var(--bg-modifier-selected)',
                accent: 'var(--bg-modifier-accent)',
            },
            text: {
                DEFAULT: 'var(--text-normal)',
                muted: 'var(--text-muted)',
                faint: 'var(--text-faint)',
                link: 'var(--text-link)',
                heading: 'var(--header-primary)',
                subheading: 'var(--header-secondary)',
                inverse: 'var(--text-inverse)',
            },
            brand: {
                DEFAULT: 'var(--brand)',
                hover: 'var(--brand-hover)',
                active: 'var(--brand-active)',
            },
            status: {
                online: 'var(--green)',
                idle: 'var(--yellow)',
                dnd: 'var(--red)',
                offline: 'var(--grey)',
            },
            danger: {
                DEFAULT: 'var(--red)',
                hover: 'var(--red-hover)',
            },
            success: 'var(--green)',
            warning: 'var(--yellow)',
            mention: {
                bg: 'var(--mention-bg)',
                text: 'var(--mention-text)',
            },
            divider: 'var(--divider)',
        },
        fontFamily: {
            sans: [
                'gg sans',
                'Noto Sans',
                'Helvetica Neue',
                'Helvetica',
                'Segoe UI',
                'sans-serif',
                'Apple Color Emoji',
                'Segoe UI Emoji',
            ],
            mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'Liberation Mono', 'monospace'],
        },
        extend: {
            fontSize: {
                // Discord's scale: dense, no oversized headings.
                '2xs': ['10px', '12px'],
                xs: ['12px', '16px'],
                sm: ['13px', '16px'],
                base: ['15px', '20px'],
                message: ['16px', '22px'],
                'message-mobile': ['15px', '21px'],
                lg: ['16px', '20px'],
                xl: ['20px', '24px'],
                '2xl': ['24px', '30px'],
            },
            borderRadius: {
                sm: '3px',
                DEFAULT: '4px',
                md: '6px',
                lg: '8px',
                xl: '12px',
                '2xl': '16px',
            },
            spacing: {
                rail: '72px',
                sidebar: '240px',
                members: '240px',
                header: '48px',
                touch: '44px',
            },
            boxShadow: {
                // Elevation is reserved for things that float above the app.
                floating: '0 8px 16px rgba(0, 0, 0, 0.24)',
                elevated: '0 2px 10px 0 rgba(0, 0, 0, 0.2)',
                sheet: '0 -4px 24px rgba(0, 0, 0, 0.32)',
            },
            transitionDuration: {
                150: '150ms',
                250: '250ms',
            },
            keyframes: {
                'pulse-soft': {
                    '0%, 100%': { opacity: '0.55' },
                    '50%': { opacity: '0.25' },
                },
                'slide-up': {
                    from: { transform: 'translateY(100%)' },
                    to: { transform: 'translateY(0)' },
                },
                'fade-in': {
                    from: { opacity: '0' },
                    to: { opacity: '1' },
                },
            },
            animation: {
                'pulse-soft': 'pulse-soft 1.6s ease-in-out infinite',
                'slide-up': 'slide-up 250ms cubic-bezier(0.32, 0.72, 0, 1)',
                'fade-in': 'fade-in 150ms ease-out',
            },
        },
    },
    plugins: [typography],
};
export default config;
//# sourceMappingURL=tailwind.config.js.map
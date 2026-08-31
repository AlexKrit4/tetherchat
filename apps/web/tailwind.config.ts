import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

/**
 * Every colour is a CSS variable defined in src/styles/tokens.css. Tailwind's
 * default palette is deliberately dropped so a stray `bg-slate-800` cannot leak
 * into the UI and break the surface hierarchy.
 */
const config: Config = {
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

      /**
       * Surfaces deliberately avoid the names Tailwind uses for font sizes
       * (base, sm, lg, xl): a colour key called `base` would turn every
       * `text-base` into a colour utility instead of a size.
       */
      surface: {
        DEFAULT: 'var(--bg-primary)',
        secondary: 'var(--bg-secondary)',
        tertiary: 'var(--bg-tertiary)',
        floating: 'var(--bg-floating)',
        input: 'var(--input-bg)',
        overlay: 'var(--bg-overlay)',
        hover: 'var(--bg-modifier-hover)',
        active: 'var(--bg-modifier-active)',
        selected: 'var(--bg-modifier-selected)',
        accent: 'var(--bg-modifier-accent)',
        panel: 'var(--user-panel-bg)',
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
      bubble: {
        in: 'var(--bubble-in)',
        out: 'var(--bubble-out)',
      },
      /**
       * Hairline colours. Themes that separate surfaces with borders instead of
       * background steps set these; classic leaves `subtle` transparent.
       */
      hairline: {
        DEFAULT: 'var(--border-subtle)',
        strong: 'var(--border-strong)',
        solid: 'var(--border-default)',
      },
      reaction: {
        me: {
          bg: 'var(--reaction-me-bg)',
          text: 'var(--reaction-me-text)',
        },
        ring: 'var(--reaction-hover-ring)',
      },
      control: {
        DEFAULT: 'var(--control-bg)',
        hover: 'var(--control-hover)',
        active: 'var(--control-active)',
      },
    },
    fontFamily: {
      sans: 'var(--font-sans)',
      mono: 'var(--font-mono)',
    },
    extend: {
      fontSize: {
        // Discord's scale: dense, no oversized headings.
        '2xs': ['10px', '12px'],
        xs: ['12px', '16px'],
        sm: ['13px', '16px'],
        base: ['15px', '20px'],
        message: ['var(--font-size-message)', 'var(--line-height-message)'],
        'message-mobile': ['var(--font-size-message-mobile)', 'var(--line-height-message-mobile)'],
        lg: ['16px', '20px'],
        xl: ['20px', '24px'],
        '2xl': ['24px', '30px'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-base)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        bubble: 'var(--bubble-radius)',
        'bubble-tail': 'var(--bubble-radius-tail)',
      },
      spacing: {
        rail: 'var(--rail-width)',
        sidebar: 'var(--sidebar-width)',
        members: 'var(--members-width)',
        header: 'var(--header-height)',
        touch: '44px',
      },
      boxShadow: {
        // Elevation is reserved for things that float above the app.
        floating: 'var(--elevation-2)',
        elevated: 'var(--elevation-1)',
        sheet: 'var(--elevation-3)',

        /**
         * Hairlines as inset shadows rather than borders: a border would add a
         * pixel to the box in themes that draw one and take it away again in
         * themes that don't, moving the layout around on a theme switch.
         */
        hairline: 'inset 0 0 0 1px var(--border-subtle)',
        'hairline-t': 'inset 0 1px 0 var(--border-subtle)',
        'hairline-b': 'inset 0 -1px 0 var(--border-subtle)',
        'hairline-l': 'inset 1px 0 0 var(--border-subtle)',
        'hairline-r': 'inset -1px 0 0 var(--border-subtle)',
        'hairline-strong': 'inset 0 0 0 1px var(--border-strong)',
      },
      transitionDuration: {
        150: '150ms',
        250: '250ms',
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
        'in-out': 'var(--ease-in-out)',
      },
      letterSpacing: {
        heading: 'var(--letter-spacing-heading)',
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

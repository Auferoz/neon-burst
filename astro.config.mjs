// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import cloudflare from '@astrojs/cloudflare';

import vue from '@astrojs/vue';
import cloudflareCron from './integrations/cloudflare-cron';

// https://astro.build/config
export default defineConfig({
  site: 'https://neonburst.cl',

  vite: {
    plugins: [tailwindcss()],
    server: {
      watch: {
        ignored: ['**/.wrangler/**']
      }
    }
  },

  adapter: cloudflare(),
  integrations: [vue(), cloudflareCron()]
});
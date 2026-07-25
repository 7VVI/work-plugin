// vite.config.ts
import { defineConfig } from "file:///D:/manger/ownerproject/work-plugin/node_modules/vite/dist/node/index.js";
import vue from "file:///D:/manger/ownerproject/work-plugin/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import { crx } from "file:///D:/manger/ownerproject/work-plugin/node_modules/@crxjs/vite-plugin/dist/index.mjs";
import { fileURLToPath, URL } from "node:url";

// manifest.config.ts
import { defineManifest } from "file:///D:/manger/ownerproject/work-plugin/node_modules/@crxjs/vite-plugin/dist/index.mjs";

// package.json
var package_default = {
  name: "nav-portal",
  version: "1.0.0",
  private: true,
  type: "module",
  description: "Chrome extension for managing internal systems, accounts, servers, middleware",
  scripts: {
    dev: "vite",
    build: "vue-tsc --noEmit && vite build",
    preview: "vite preview",
    test: "vitest",
    "test:unit": "vitest run",
    lint: "eslint src --ext .ts,.vue",
    "type-check": "vue-tsc --noEmit",
    zip: "cd dist && zip -r ../nav-portal-v$npm_package_version.zip ."
  },
  dependencies: {
    dexie: "^4.0.4",
    "front-matter": "^4.0.2",
    "markdown-it": "^14.1.0",
    pinia: "^2.1.7",
    vue: "^3.4.21",
    "vue-draggable-plus": "^0.6.1",
    "vue-router": "^4.3.0"
  },
  devDependencies: {
    "@crxjs/vite-plugin": "^2.0.0-beta.25",
    "@types/chrome": "^0.0.263",
    "@types/markdown-it": "^14.0.1",
    "@typescript-eslint/eslint-plugin": "^7.18.0",
    "@typescript-eslint/parser": "^7.18.0",
    "@vitejs/plugin-vue": "^5.0.4",
    "@vue/test-utils": "^2.4.5",
    eslint: "^8.57.1",
    "eslint-plugin-vue": "^9.33.0",
    "fake-indexeddb": "^6.0.0",
    jsdom: "^24.0.0",
    typescript: "^5.4.3",
    vite: "^5.2.6",
    vitest: "^1.4.0",
    "vue-tsc": "^2.0.7"
  }
};

// manifest.config.ts
var manifest_config_default = defineManifest({
  manifest_version: 3,
  name: "Dock",
  version: package_default.version,
  description: package_default.description,
  action: {
    default_popup: "popup.html",
    default_title: "Dock",
    default_icon: {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  icons: {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  options_ui: {
    page: "dashboard.html",
    open_in_tab: true
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module"
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/index.ts"],
      run_at: "document_idle"
    }
  ],
  commands: {
    "auto-fill-current": {
      suggested_key: {
        default: "Ctrl+Shift+L",
        mac: "Command+Shift+L"
      },
      description: "Auto-fill credentials on current page"
    },
    _execute_action: {
      suggested_key: {
        default: "Ctrl+Shift+K",
        mac: "Command+Shift+K"
      }
    }
  },
  permissions: [
    "storage",
    "contextMenus",
    "tabs",
    "clipboardWrite",
    "notifications",
    "commands",
    "alarms"
  ],
  host_permissions: ["<all_urls>"]
});

// vite.config.ts
var __vite_injected_original_import_meta_url = "file:///D:/manger/ownerproject/work-plugin/vite.config.ts";
var vite_config_default = defineConfig({
  plugins: [vue(), crx({ manifest: manifest_config_default })],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url)),
      "@shared": fileURLToPath(new URL("./src/shared", __vite_injected_original_import_meta_url))
    }
  },
  build: {
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      output: {
        chunkFileNames: "assets/chunk-[hash].js"
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAibWFuaWZlc3QuY29uZmlnLnRzIiwgInBhY2thZ2UuanNvbiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkQ6XFxcXG1hbmdlclxcXFxvd25lcnByb2plY3RcXFxcd29yay1wbHVnaW5cIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXG1hbmdlclxcXFxvd25lcnByb2plY3RcXFxcd29yay1wbHVnaW5cXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0Q6L21hbmdlci9vd25lcnByb2plY3Qvd29yay1wbHVnaW4vdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcclxuaW1wb3J0IHZ1ZSBmcm9tICdAdml0ZWpzL3BsdWdpbi12dWUnO1xyXG5pbXBvcnQgeyBjcnggfSBmcm9tICdAY3J4anMvdml0ZS1wbHVnaW4nO1xyXG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoLCBVUkwgfSBmcm9tICdub2RlOnVybCc7XHJcbmltcG9ydCBtYW5pZmVzdCBmcm9tICcuL21hbmlmZXN0LmNvbmZpZyc7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xyXG4gIHBsdWdpbnM6IFt2dWUoKSwgY3J4KHsgbWFuaWZlc3QgfSldLFxyXG4gIHJlc29sdmU6IHtcclxuICAgIGFsaWFzOiB7XHJcbiAgICAgICdAJzogZmlsZVVSTFRvUGF0aChuZXcgVVJMKCcuL3NyYycsIGltcG9ydC5tZXRhLnVybCkpLFxyXG4gICAgICAnQHNoYXJlZCc6IGZpbGVVUkxUb1BhdGgobmV3IFVSTCgnLi9zcmMvc2hhcmVkJywgaW1wb3J0Lm1ldGEudXJsKSksXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgYnVpbGQ6IHtcclxuICAgIHRhcmdldDogJ2VzMjAyMicsXHJcbiAgICBzb3VyY2VtYXA6IHRydWUsXHJcbiAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgIG91dHB1dDoge1xyXG4gICAgICAgIGNodW5rRmlsZU5hbWVzOiAnYXNzZXRzL2NodW5rLVtoYXNoXS5qcycsXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIH0sXHJcbn0pO1xyXG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkQ6XFxcXG1hbmdlclxcXFxvd25lcnByb2plY3RcXFxcd29yay1wbHVnaW5cIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXG1hbmdlclxcXFxvd25lcnByb2plY3RcXFxcd29yay1wbHVnaW5cXFxcbWFuaWZlc3QuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9tYW5nZXIvb3duZXJwcm9qZWN0L3dvcmstcGx1Z2luL21hbmlmZXN0LmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZU1hbmlmZXN0IH0gZnJvbSAnQGNyeGpzL3ZpdGUtcGx1Z2luJztcclxuaW1wb3J0IHBrZyBmcm9tICcuL3BhY2thZ2UuanNvbic7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVNYW5pZmVzdCh7XHJcbiAgbWFuaWZlc3RfdmVyc2lvbjogMyxcclxuICBuYW1lOiAnRG9jaycsXHJcbiAgdmVyc2lvbjogcGtnLnZlcnNpb24sXHJcbiAgZGVzY3JpcHRpb246IHBrZy5kZXNjcmlwdGlvbixcclxuICBhY3Rpb246IHtcclxuICAgIGRlZmF1bHRfcG9wdXA6ICdwb3B1cC5odG1sJyxcclxuICAgIGRlZmF1bHRfdGl0bGU6ICdEb2NrJyxcclxuICAgIGRlZmF1bHRfaWNvbjoge1xyXG4gICAgICAnMTYnOiAnaWNvbnMvaWNvbi0xNi5wbmcnLFxyXG4gICAgICAnMzInOiAnaWNvbnMvaWNvbi0zMi5wbmcnLFxyXG4gICAgICAnNDgnOiAnaWNvbnMvaWNvbi00OC5wbmcnLFxyXG4gICAgICAnMTI4JzogJ2ljb25zL2ljb24tMTI4LnBuZycsXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgaWNvbnM6IHtcclxuICAgICcxNic6ICdpY29ucy9pY29uLTE2LnBuZycsXHJcbiAgICAnNDgnOiAnaWNvbnMvaWNvbi00OC5wbmcnLFxyXG4gICAgJzEyOCc6ICdpY29ucy9pY29uLTEyOC5wbmcnLFxyXG4gIH0sXHJcbiAgb3B0aW9uc191aToge1xyXG4gICAgcGFnZTogJ2Rhc2hib2FyZC5odG1sJyxcclxuICAgIG9wZW5faW5fdGFiOiB0cnVlLFxyXG4gIH0sXHJcbiAgYmFja2dyb3VuZDoge1xyXG4gICAgc2VydmljZV93b3JrZXI6ICdzcmMvYmFja2dyb3VuZC9pbmRleC50cycsXHJcbiAgICB0eXBlOiAnbW9kdWxlJyxcclxuICB9LFxyXG4gIGNvbnRlbnRfc2NyaXB0czogW1xyXG4gICAge1xyXG4gICAgICBtYXRjaGVzOiBbJzxhbGxfdXJscz4nXSxcclxuICAgICAganM6IFsnc3JjL2NvbnRlbnQvaW5kZXgudHMnXSxcclxuICAgICAgcnVuX2F0OiAnZG9jdW1lbnRfaWRsZScsXHJcbiAgICB9LFxyXG4gIF0sXHJcbiAgY29tbWFuZHM6IHtcclxuICAgICdhdXRvLWZpbGwtY3VycmVudCc6IHtcclxuICAgICAgc3VnZ2VzdGVkX2tleToge1xyXG4gICAgICAgIGRlZmF1bHQ6ICdDdHJsK1NoaWZ0K0wnLFxyXG4gICAgICAgIG1hYzogJ0NvbW1hbmQrU2hpZnQrTCcsXHJcbiAgICAgIH0sXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQXV0by1maWxsIGNyZWRlbnRpYWxzIG9uIGN1cnJlbnQgcGFnZScsXHJcbiAgICB9LFxyXG4gICAgX2V4ZWN1dGVfYWN0aW9uOiB7XHJcbiAgICAgIHN1Z2dlc3RlZF9rZXk6IHtcclxuICAgICAgICBkZWZhdWx0OiAnQ3RybCtTaGlmdCtLJyxcclxuICAgICAgICBtYWM6ICdDb21tYW5kK1NoaWZ0K0snLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICB9LFxyXG4gIHBlcm1pc3Npb25zOiBbXHJcbiAgICAnc3RvcmFnZScsXHJcbiAgICAnY29udGV4dE1lbnVzJyxcclxuICAgICd0YWJzJyxcclxuICAgICdjbGlwYm9hcmRXcml0ZScsXHJcbiAgICAnbm90aWZpY2F0aW9ucycsXHJcbiAgICAnY29tbWFuZHMnLFxyXG4gICAgJ2FsYXJtcycsXHJcbiAgXSxcclxuICBob3N0X3Blcm1pc3Npb25zOiBbJzxhbGxfdXJscz4nXSxcclxufSk7XHJcbiIsICJ7XHJcbiAgXCJuYW1lXCI6IFwibmF2LXBvcnRhbFwiLFxyXG4gIFwidmVyc2lvblwiOiBcIjEuMC4wXCIsXHJcbiAgXCJwcml2YXRlXCI6IHRydWUsXHJcbiAgXCJ0eXBlXCI6IFwibW9kdWxlXCIsXHJcbiAgXCJkZXNjcmlwdGlvblwiOiBcIkNocm9tZSBleHRlbnNpb24gZm9yIG1hbmFnaW5nIGludGVybmFsIHN5c3RlbXMsIGFjY291bnRzLCBzZXJ2ZXJzLCBtaWRkbGV3YXJlXCIsXHJcbiAgXCJzY3JpcHRzXCI6IHtcclxuICAgIFwiZGV2XCI6IFwidml0ZVwiLFxyXG4gICAgXCJidWlsZFwiOiBcInZ1ZS10c2MgLS1ub0VtaXQgJiYgdml0ZSBidWlsZFwiLFxyXG4gICAgXCJwcmV2aWV3XCI6IFwidml0ZSBwcmV2aWV3XCIsXHJcbiAgICBcInRlc3RcIjogXCJ2aXRlc3RcIixcclxuICAgIFwidGVzdDp1bml0XCI6IFwidml0ZXN0IHJ1blwiLFxyXG4gICAgXCJsaW50XCI6IFwiZXNsaW50IHNyYyAtLWV4dCAudHMsLnZ1ZVwiLFxyXG4gICAgXCJ0eXBlLWNoZWNrXCI6IFwidnVlLXRzYyAtLW5vRW1pdFwiLFxyXG4gICAgXCJ6aXBcIjogXCJjZCBkaXN0ICYmIHppcCAtciAuLi9uYXYtcG9ydGFsLXYkbnBtX3BhY2thZ2VfdmVyc2lvbi56aXAgLlwiXHJcbiAgfSxcclxuICBcImRlcGVuZGVuY2llc1wiOiB7XHJcbiAgICBcImRleGllXCI6IFwiXjQuMC40XCIsXHJcbiAgICBcImZyb250LW1hdHRlclwiOiBcIl40LjAuMlwiLFxyXG4gICAgXCJtYXJrZG93bi1pdFwiOiBcIl4xNC4xLjBcIixcclxuICAgIFwicGluaWFcIjogXCJeMi4xLjdcIixcclxuICAgIFwidnVlXCI6IFwiXjMuNC4yMVwiLFxyXG4gICAgXCJ2dWUtZHJhZ2dhYmxlLXBsdXNcIjogXCJeMC42LjFcIixcclxuICAgIFwidnVlLXJvdXRlclwiOiBcIl40LjMuMFwiXHJcbiAgfSxcclxuICBcImRldkRlcGVuZGVuY2llc1wiOiB7XHJcbiAgICBcIkBjcnhqcy92aXRlLXBsdWdpblwiOiBcIl4yLjAuMC1iZXRhLjI1XCIsXHJcbiAgICBcIkB0eXBlcy9jaHJvbWVcIjogXCJeMC4wLjI2M1wiLFxyXG4gICAgXCJAdHlwZXMvbWFya2Rvd24taXRcIjogXCJeMTQuMC4xXCIsXHJcbiAgICBcIkB0eXBlc2NyaXB0LWVzbGludC9lc2xpbnQtcGx1Z2luXCI6IFwiXjcuMTguMFwiLFxyXG4gICAgXCJAdHlwZXNjcmlwdC1lc2xpbnQvcGFyc2VyXCI6IFwiXjcuMTguMFwiLFxyXG4gICAgXCJAdml0ZWpzL3BsdWdpbi12dWVcIjogXCJeNS4wLjRcIixcclxuICAgIFwiQHZ1ZS90ZXN0LXV0aWxzXCI6IFwiXjIuNC41XCIsXHJcbiAgICBcImVzbGludFwiOiBcIl44LjU3LjFcIixcclxuICAgIFwiZXNsaW50LXBsdWdpbi12dWVcIjogXCJeOS4zMy4wXCIsXHJcbiAgICBcImZha2UtaW5kZXhlZGRiXCI6IFwiXjYuMC4wXCIsXHJcbiAgICBcImpzZG9tXCI6IFwiXjI0LjAuMFwiLFxyXG4gICAgXCJ0eXBlc2NyaXB0XCI6IFwiXjUuNC4zXCIsXHJcbiAgICBcInZpdGVcIjogXCJeNS4yLjZcIixcclxuICAgIFwidml0ZXN0XCI6IFwiXjEuNC4wXCIsXHJcbiAgICBcInZ1ZS10c2NcIjogXCJeMi4w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

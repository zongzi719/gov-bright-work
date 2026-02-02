import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import legacy from "@vitejs/plugin-legacy";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // 添加旧浏览器兼容性支持（针对麒麟系统老版本Firefox/Chrome）
    legacy({
      targets: ["Firefox >= 52", "Chrome >= 49", "ie >= 11"],
      // 为旧版浏览器添加必要的 polyfills
      additionalLegacyPolyfills: ["regenerator-runtime/runtime"],
      // 关键：为"半现代"浏览器（如 Firefox 62）也添加 polyfills
      modernPolyfills: true,
      // 确保旧版浏览器能正确加载
      renderLegacyChunks: true,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // 防止 React 重复实例导致 useEffect hooks 错误
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
  },
  build: {
    // 确保生成兼容旧浏览器的代码
    target: "es2015",
    // 明确的 rollup 配置确保正确的模块分割
    rollupOptions: {
      output: {
        // 确保 React 只有一个实例
        manualChunks: {
          react: ["react", "react-dom"],
        },
      },
    },
  },
}));

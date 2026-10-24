# ─────────────────────────────────────────────────────────
# AXOS Frontend – Dockerfile
# Build do Vite + serve com Nginx
# ─────────────────────────────────────────────────────────

FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --frozen-lockfile

COPY . .

# Build de produção
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_URL

RUN npm run build

# ─── Nginx para servir o PWA ──────────────────────────
FROM nginx:alpine AS runner

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copia config otimizada para PWA/SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia os arquivos estáticos buildados
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

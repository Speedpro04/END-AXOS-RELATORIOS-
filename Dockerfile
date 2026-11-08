# ─────────────────────────────────────────────────────────
# AXOS Frontend – build a partir da raiz do repositório
# Mesma imagem de frontend/Dockerfile, para o EasyPanel na raiz.
# ─────────────────────────────────────────────────────────

FROM node:22-alpine AS builder

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_URL

RUN npm run build

FROM nginx:alpine AS runner

RUN rm /etc/nginx/conf.d/default.conf
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

# Landing page na raiz do domínio (o app abre em /app)
COPY landing/index.html /usr/share/nginx/html/lp.html
COPY landing/robots.txt landing/sitemap.xml landing/llms.txt landing/politica-de-privacidade.html landing/termos-de-uso.html /usr/share/nginx/html/
COPY landing/assets/ /usr/share/nginx/html/assets/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

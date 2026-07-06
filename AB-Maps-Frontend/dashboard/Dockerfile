FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund || npm install --legacy-peer-deps --no-audit --no-fund
COPY . .
# NEXT_PUBLIC_* are inlined here from .env.production (copied above)
RUN npm run build
EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm", "run", "start", "--", "-p", "3000", "-H", "0.0.0.0"]

# Stage 1 — install dependencies and build the React frontend
FROM node:20-alpine AS builder
WORKDIR /app

ARG VITE_SUPABASE_PROJECT_ID
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SUPABASE_URL
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL

COPY package*.json ./
COPY scripts/install-git-hooks.mjs ./scripts/install-git-hooks.mjs
RUN npm ci || npm install --legacy-peer-deps

COPY . .
# Builds the Vite frontend — output goes to dist/
RUN npm run build

# Stage 2 — lean production image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Re-install only production dependencies
COPY package*.json ./
COPY scripts/install-git-hooks.mjs ./scripts/install-git-hooks.mjs
RUN npm ci --omit=dev || npm install --legacy-peer-deps --omit=dev

# Copy compiled frontend assets from Stage 1
COPY --from=builder /app/dist ./dist

# Copy the server source — adjust this path if your server lives elsewhere
COPY --from=builder /app/server ./server

# Uncomment below if your server entry point is at the project root:
# COPY --from=builder /app/*.js ./

EXPOSE 5000
# Adjust this to match your server entry point (check package.json "start" script)
CMD ["node", "dist/index.cjs"]

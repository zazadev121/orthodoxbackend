FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY supabase/functions/_shared ./supabase/functions/_shared
USER node
ENV PORT=4000
EXPOSE 4000
CMD ["node", "src/server.js"]

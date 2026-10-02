FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node backend ./backend
COPY --chown=node:node database ./database
COPY --chown=node:node frontend ./frontend
USER node
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["node", "backend/src/server.js"]

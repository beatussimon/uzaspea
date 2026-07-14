FROM node:20-slim AS build-stage
WORKDIR /app
COPY package*.json ./
# FIX DEVOPS-19: deterministic installs
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build-stage /app/dist /usr/share/nginx/html
# FIX DEVOPS-11
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Support running Nginx as non-root on port 8080
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /var/log/nginx /usr/share/nginx/html
USER nginx
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]

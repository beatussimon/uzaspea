FROM node:20-slim AS build-stage
WORKDIR /app
COPY package*.json ./
RUN npm ci  # FIX DEVOPS-19: deterministic installs
COPY . .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build-stage /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf  # FIX DEVOPS-11
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

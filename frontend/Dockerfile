FROM nginx:alpine
# dist folder must be built locally and rsync'd to the server before running docker build!
COPY dist /usr/share/nginx/html
# FIX DEVOPS-11
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Support running Nginx as non-root on port 8080
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /var/log/nginx /usr/share/nginx/html
USER nginx
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]

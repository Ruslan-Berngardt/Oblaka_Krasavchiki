FROM nginx:1.28-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/ /usr/share/nginx/html/
RUN rm -f /usr/share/nginx/html/Dockerfile /usr/share/nginx/html/nginx.conf
HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=12 CMD wget -q --spider http://127.0.0.1/ || exit 1
EXPOSE 80

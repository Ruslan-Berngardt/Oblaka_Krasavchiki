FROM nginx:alpine
RUN apk add --no-cache apache2-utils && \
    htpasswd -bc /etc/nginx/.htpasswd admin admin123
COPY admin.html /etc/nginx/admin.html
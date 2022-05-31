# pull a nginx image
FROM nginx:alpine

RUN apk update \
    && apk add jq \
    && rm -rf /var/cache/apk/*

# Set working directory to nginx asset directory
WORKDIR /usr/share/nginx/html
# Remove default nginx static assets
RUN rm -rf ./*

# Copy assets over so Nginx can properly serve 
COPY apps/map/index.html .
COPY apps/map/styles.css .
COPY apps/map/script.js .
COPY apps/map/config.example.json /usr/share/nginx/html/config.json
RUN chown -R nginx:nginx /usr/share/nginx/html

COPY ./build/app-map/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Containers run nginx with global directives and daemon off
ENTRYPOINT [ "docker-entrypoint.sh" ]
CMD ["nginx", "-g", "daemon off;"]
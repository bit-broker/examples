# pull a nginx image
FROM nginx:alpine

RUN apk update \
    && apk add jq \
    && rm -rf /var/cache/apk/*

# Set working directory to nginx asset directory
WORKDIR /usr/share/nginx/html
# Remove default nginx static assets
RUN rm -rf ./*
# make css directory
RUN mkdir -p ./css  && \
    mkdir -p ./assets && \
    mkdir -p ./config

# Copy assets over so Nginx can properly serve 
COPY apps/explorer/index.html .
COPY apps/explorer/assets/logo.svg ./assets
COPY apps/explorer/css/styles.css ./css
COPY apps/explorer/index.js .
COPY apps/explorer/config/example-config.json ./config/config.json

COPY ./build/explorer/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Containers run nginx with global directives and daemon off
ENTRYPOINT [ "docker-entrypoint.sh" ]
CMD ["nginx", "-g", "daemon off;"]
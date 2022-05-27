# pull a nginx image
FROM nginx:alpine
# Set working directory to nginx asset directory
WORKDIR /usr/share/nginx/html
# Remove default nginx static assets
RUN rm -rf ./*
# make css directory
RUN mkdir ./css
# Copy assets over so Nginx can properly serve 
COPY apps/explorer/index.html .
COPY apps/explorer/css/styles.css ./css
COPY apps/explorer/index.js .
COPY apps/explorer/example-config.json ./config.json
# Containers run nginx with global directives and daemon off
ENTRYPOINT ["nginx", "-g", "daemon off;"]
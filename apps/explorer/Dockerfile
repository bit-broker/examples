# pull a nginx image
FROM nginx:alpine
# Set working directory to nginx asset directory
WORKDIR /usr/share/nginx/html
# Remove default nginx static assets
RUN rm -rf ./*
# make css directory
Run mkdir ./css
# Copy assets over so Nginx can properly serve 
COPY ./index.html .
COPY ./css/styles.css ./css
COPY ./index.js .
# Containers run nginx with global directives and daemon off
ENTRYPOINT ["nginx", "-g", "daemon off;"]
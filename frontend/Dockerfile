# The frontend is a single static HTML file.
# Nginx serves it and also acts as a reverse proxy to the API container.
FROM nginx:1.27-alpine

# Remove the default placeholder page
RUN rm /usr/share/nginx/html/index.html

# Copy our app
COPY index.html /usr/share/nginx/html/index.html

# Copy the nginx config that proxies /api and /health to the API container
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

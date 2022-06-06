FROM nginx:alpine
COPY fonts /usr/share/nginx/html/fonts
COPY img /usr/share/nginx/html/img
COPY js /usr/share/nginx/html/js
COPY style /usr/share/nginx/html/style
COPY index.html /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
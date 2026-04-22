FROM nginx:alpine

RUN apk add --no-cache gettext

COPY infra/nginx/default.http.conf.template /etc/nginx/templates/default.http.conf.template
COPY infra/nginx/default.https.conf.template /etc/nginx/templates/default.https.conf.template
COPY infra/nginx/docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]

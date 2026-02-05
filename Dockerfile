##
## digiserve/ab-definition-manager:master
##
## This is our microservice for our AppBuilder Definitions.
##
## Security: image runs as non-root user `defmgr`. For production, prefer
## pinning the base image by digest and overriding CMD to remove --inspect.
##
## Docker Commands:
## ---------------
## $ docker build -t digiserve/ab-definition-manager:master .
## $ docker push digiserve/ab-definition-manager:master
##
## Multi-platform (M1/M2/M3 Mac → amd64 + arm64):
## $ docker buildx create --use  # once, if no builder
## $ docker buildx build --platform linux/amd64,linux/arm64 -t digiserve/ab-definition-manager:master --push .
## Or use: $ DOCKER_ARGS="--platform linux/amd64,linux/arm64 --push" ./build.sh
##

ARG BRANCH=master

FROM digiserve/service-cli:${BRANCH}

# Run as non-root to limit impact of compromise
RUN groupadd -r defmgr && useradd -r -g defmgr -d /app -s /sbin/nologin -c "Definition Manager service" defmgr

COPY . /app

WORKDIR /app

# Reproducible install; use npm i -f only if npm ci fails (e.g. peer deps)
#RUN npm ci && npm cache clean --force
RUN npm i -f && npm cache clean --force

WORKDIR /app/AppBuilder

#RUN npm ci && npm cache clean --force
RUN npm i -f && npm cache clean --force

WORKDIR /app

RUN chown -R defmgr:defmgr /app

USER defmgr

# --inspect=0.0.0.0:9229 exposes debugger to the network; omit in production or bind to 127.0.0.1
CMD [ "node", "--inspect=0.0.0.0:9229", "--max-old-space-size=8192", "--stack-size=8192", "app.js" ]

#!/usr/bin/with-contenv bashio

# /data persists; PORT must match ingress_port
export STATE_FILE="/data/coffee.json"
export PORT=3300

if bashio::config.has_value 'currency'; then
    export CURRENCY="$(bashio::config 'currency')"
fi

# ssl: https on 3301 with HA's certificate (file name only, always in /ssl)
if bashio::config.true 'ssl'; then
    CERTFILE="$(bashio::config 'certfile')"
    KEYFILE="$(bashio::config 'keyfile')"
    CERTFILE="/ssl/${CERTFILE##*/}"
    KEYFILE="/ssl/${KEYFILE##*/}"
    if [ -f "${CERTFILE}" ] && [ -f "${KEYFILE}" ]; then
        export HTTPS_PORT=3301
        export TLS_CERT="${CERTFILE}"
        export TLS_KEY="${KEYFILE}"
        bashio::log.info "https on port ${HTTPS_PORT} with ${CERTFILE}"
    else
        bashio::log.warning "ssl is on, but ${CERTFILE} or ${KEYFILE} doesn't exist: no https"
    fi
fi

bashio::log.info "Starting Bean There on port ${PORT}..."
exec node /app/src/server.js

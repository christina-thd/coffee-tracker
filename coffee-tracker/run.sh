#!/usr/bin/with-contenv bashio

# Beans and brews are kept in the add-on's persistent /data folder
export STATE_FILE="/data/coffee.json"
# Must match ingress_port in config.yaml
export PORT=3300

# The currency symbol prices are shown with (see DOCS.md)
if bashio::config.has_value 'currency'; then
    export CURRENCY="$(bashio::config 'currency')"
fi

bashio::log.info "Starting Bean There on port ${PORT}..."
exec node /app/src/server.js

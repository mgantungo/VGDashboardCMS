BC- token : 81b68bbd15c779d2ab5c6c863ee3f6085178cec63e8e69cd6143b496e192f1368140edcf3a9ddad6c8760ca6046136e8e4cd2ba737aee9d3cfd3322f4939da470c8f4291125c8aea76f6c19d38a1c4d86a5128ddb20af49361d73e60c779af8899129ee5be1c13ea0b24712f1b7629c1815b957161352067d944aae0c792bda0
/etc/systemd/system/strapi-bc-monitor.service

[Unit]
Description=Strapi Business Central Invoice Monitor
Documentation=https://github.com/mgantungo/VGDashboardCMS/blob/main/README%20-%20BC%20-%20SYNC%20-%20MONITOR.md
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=www-data
Group=www-data
WorkingDirectory=/var/www/VGDashboardCMS
Environment=NODE_ENV=production
EnvironmentFile=/var/www/VGDashboardCMS/.env
ExecStart=/usr/bin/npm run monitor:bc
StandardOutput=journal
StandardError=journal
Restart=no
Nice=10

# Security hardening
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/www/VGDashboardCMS/logs

[Install]
WantedBy=multi-user.target





# /etc/systemd/system/strapi-bc-monitor.timer
[Unit]
Description=Run Strapi BC Monitor every 2 minutes

Requires=strapi-bc-monitor.service

[Timer]
# Start 1 minute after boot
OnBootSec=1min

# Wait 2 minutes after the service finishes before starting again
OnUnitActiveSec=2min

# If the system was off, catch up on missed runs
Persistent=true

# Randomize start time to avoid thundering herd
RandomizedDelaySec=30

[Install]
WantedBy=timers.target





#!/bin/sh

cnf_dir='/mnt/openssl/'
certs_dir='/etc/ssl/certs/'
openssl req -config ${cnf_dir}beamshareCA.cnf -new -x509 -days 1 -keyout ${certs_dir}beamshareCA.key -out ${certs_dir}beamshareCA.crt
openssl req -config ${cnf_dir}beamshareCert.cnf -new -out /tmp/beamshare-dev.csr -keyout ${certs_dir}beamshare-dev.key
openssl x509 -req -in /tmp/beamshare-dev.csr -CA ${certs_dir}beamshareCA.crt -CAkey ${certs_dir}beamshareCA.key -CAcreateserial -extensions req_ext -extfile ${cnf_dir}beamshareCert.cnf -sha512 -days 1 -out ${certs_dir}beamshare-dev.crt

exec "$@"

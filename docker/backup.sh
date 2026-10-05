#!/bin/sh
# Backup agendado do Postgres e dos arquivos (avatars etc.). Roda na subida e depois a cada
# BACKUP_INTERVALO_HORAS. Apaga o que passar de BACKUP_RETENCAO_DIAS.
# Restaurar: veja docker/LEIA-ME.md ("Restaurar um backup").
set -eu
export PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD ausente}"
INTERVALO=$(( ${BACKUP_INTERVALO_HORAS:-24} * 3600 ))
RETENCAO=${BACKUP_RETENCAO_DIAS:-14}

while true; do
  carimbo=$(date -u +%Y%m%dT%H%M%SZ)
  if pg_dump -h db -U supabase_admin -d postgres -Fc -f "/backups/banco-$carimbo.dump.tmp" \
     && tar -czf "/backups/arquivos-$carimbo.tar.gz.tmp" -C /var/lib/storage . ; then
    mv "/backups/banco-$carimbo.dump.tmp" "/backups/banco-$carimbo.dump"
    mv "/backups/arquivos-$carimbo.tar.gz.tmp" "/backups/arquivos-$carimbo.tar.gz"
    echo "Backup $carimbo concluído."
  else
    rm -f /backups/*.tmp
    echo "ERRO: backup $carimbo falhou." >&2
  fi
  find /backups -type f \( -name 'banco-*.dump' -o -name 'arquivos-*.tar.gz' \) -mtime "+$RETENCAO" -delete
  sleep "$INTERVALO"
done

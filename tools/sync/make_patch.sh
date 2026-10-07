#!/usr/bin/env bash
# make_patch.sh — сторона АГЕНТА: собрать патч из файлов проекта и выложить его
# в AI Drive (/orbit_sync/to_laptop), чтобы пользователь забрал его командой pull.
#
#   make_patch.sh -d <корень проекта> -v <версия> -m "<описание>" [файлы...]
#
#   -d|--dir <путь>     корень проекта (по умолчанию текущая папка)
#   -v|--version <ver>  версия патча, например 20260921-01 (по умолчанию — дата-01)
#   -m|--message <текст> описание этапа (увидит пользователь в выводе pull)
#   -t|--to <папка>     папка на AI Drive (по умолчанию /orbit_sync/to_laptop)
#   -o|--out <файл>     куда положить zip (по умолчанию <проект>/.sync/outgoing/)
#   --deleted <путь>    файл, который нужно удалить у пользователя (можно несколько раз)
#   --no-upload         только собрать zip и PATCH_INFO.txt, никуда не заливать
#   без позиционных аргументов — берутся все файлы под контролем git (ls-files)
#
# Пример:
#   bash make_patch.sh -d ~/workspace/dev/orbit -v 20261004-01 \
#        -m "Этап 1: ..." app/... docs/PROJECT_STATE.md
set -euo pipefail

ROOT="$PWD"
VERSION="$(date -u +%Y%m%d)-01"
MESSAGE=""
TO="/orbit_sync/to_laptop"
OUT=""
UPLOAD=1
PATHS=()
DELETED=()
ARCHIVE_NAME="orbit_patch.zip"

say()  { printf '%s\n' "$*"; }
ok()   { printf '[ok] %s\n' "$*"; }
fail() { printf '[x]  %s\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    -d|--dir) ROOT="$(cd "$2" && pwd)"; shift 2 ;;
    -v|--version) VERSION="$2"; shift 2 ;;
    -m|--message) MESSAGE="$2"; shift 2 ;;
    -t|--to) TO="$2"; shift 2 ;;
    -o|--out) OUT="$2"; shift 2 ;;
    --deleted) DELETED+=("$2"); shift 2 ;;
    --no-upload) UPLOAD=0; shift ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) PATHS+=("$1"); shift ;;
  esac
done

[ -n "$ROOT" ] || fail "не задан корень проекта"
cd "$ROOT"

if [ "${#PATHS[@]}" -eq 0 ]; then
  command -v git >/dev/null 2>&1 && git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1 \
    || fail "git недоступен и файлы не указаны"
  while IFS= read -r p; do PATHS+=("$p"); done < <( git -C "$ROOT" ls-files --cached --others --exclude-standard | grep -v '^\.sync/')
fi

[ "${#PATHS[@]}" -gt 0 ] || fail "список файлов пуст"

STAGE="$ROOT/.sync/outgoing"
mkdir -p "$STAGE"
ZIP="${OUT:-$STAGE/$ARCHIVE_NAME}"
INFO="$(dirname "$ZIP")/PATCH_INFO.txt"

PY="${PYTHON:-python3}"
command -v "$PY" >/dev/null 2>&1 || PY=python

"$PY" - "$ZIP" "${PATHS[@]}" <<'PY'
import os, sys, zipfile
zip_path, paths = sys.argv[1], sys.argv[2:]
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for rel in paths:
        rel = rel.replace('\\', '/')
        if rel.startswith('./'):
            rel = rel[2:]
        rel = rel.lstrip('/')
        if os.path.isabs(rel):
            rel = os.path.relpath(rel, os.getcwd())
        if not os.path.isfile(rel):
            print('  пропущен (нет файла): ' + rel, file=sys.stderr)
            continue
        z.write(rel, rel)
PY

ZIP_BYTES="$(wc -c < "$ZIP" | tr -d ' ')"
ZIP_HASH="$($PY - "$ZIP" <<'PY'
import hashlib, sys
h = hashlib.sha256()
with open(sys.argv[1], 'rb') as fh:
    for c in iter(lambda: fh.read(1 << 20), b''):
        h.update(c)
print(h.hexdigest())
PY
)"
HEAD="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || echo n/a)"

{
  echo "version: $VERSION"
  echo "created_utc: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "created_by: Genspark Super Agent"
  echo "account: $(gsk me 2>/dev/null | grep -Eo '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+' | head -n1 || true)"
  echo "message: ${MESSAGE:-без описания}"
  echo "base_head: $HEAD"
  echo "archive: $ARCHIVE_NAME"
  echo "archive_bytes: $ZIP_BYTES"
  echo "zip_sha256: $ZIP_HASH"
  echo "files_count: $(grep -c . <<<"$(printf '%s\n' "${PATHS[@]}")")"
  echo "files:"
  for rel in "${PATHS[@]}"; do
    [ -f "$rel" ] || continue
    echo "  $rel $($PY - "$rel" <<'PY'
import hashlib, sys
h = hashlib.sha256()
with open(sys.argv[1], 'rb') as fh:
    for c in iter(lambda: fh.read(1 << 20), b''):
        h.update(c)
print(h.hexdigest())
PY
)"
  done
  if [ "${#DELETED[@]}" -gt 0 ]; then
    echo "deleted:"
    for d in "${DELETED[@]}"; do echo "  $d"; done
  fi
} > "$INFO"

ok "патч собран: $ZIP ($ZIP_BYTES байт, sha256 ${ZIP_HASH:0:12}…)"
ok "описание:    $INFO"

if [ "$UPLOAD" -eq 1 ]; then
  command -v gsk >/dev/null 2>&1 || fail "gsk не найден"
  gsk aidrive mkdir -p "$TO" >/dev/null 2>&1 || true
  gsk aidrive upload --local_file "$ZIP" --upload_path "$TO/$ARCHIVE_NAME" --override -y >/dev/null \
    || fail "не удалось залить $ARCHIVE_NAME"
  gsk aidrive upload --local_file "$INFO" --upload_path "$TO/PATCH_INFO.txt" --override -y >/dev/null \
    || fail "не удалось залить PATCH_INFO.txt"
  ok "выложено в $TO (версия $VERSION)"
else
  say "--no-upload: только сборка"
fi

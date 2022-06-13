#!/bin/bash
set -e

tmp=$(mktemp)
configfile='/usr/share/nginx/html/config/config.json'

if [[ -z "${BASE_URL}" ]]; then
  :
else
  jq --arg baseUrl "$BASE_URL" '.baseUrl = $baseUrl' "$configfile" > "$tmp" && mv "$tmp" "$configfile"
fi

PREFIX_LIST=("POLICY_ TOKEN_ NAME_ DESC_")

for PREFIX in ${PREFIX_LIST[*]}; do

  eval 'LIST=(${!'"$PREFIX"'@})'

  if [[ -z "${LIST}" ]]; then

    echo "no env vars found with prefix: $PREFIX ..."

  else

    for ITEM in ${LIST[*]}; do

      PROP=""

      case $PREFIX in

        POLICY_)
          PROP=id
          ;;

        TOKEN_)
          PROP=token
          ;;

        NAME_)
          PROP=name
          ;;

        DESC_)
          PROP=description
          ;;
      esac

      if [[ -z "${PROP}" ]]; then
        :
      else

        INDEX="${ITEM//[!0-9]/}"
        jq --arg $PROP "${!ITEM}" ".policies[$INDEX].$PROP = \$$PROP" "$configfile" > "$tmp" && mv "$tmp" "$configfile"

      fi

    done

  fi

done

chmod a+r $configfile

# Run cmd
exec "$@"
#!/bin/bash
# Copyright 2022 Cisco and its affiliates
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

# Script to configure BBK platform instance for demo deployment

# Config Variables

WEBHOOK_BASE="http://bbkt-webhook"
COORD_BASE="http://bbk-coordinator:8001"
BOOTSTRAP_KEY="abc123"
HELM_DEPLOY=0


# Functions

function register_entity() {
    ENTITY="$1"

    STATUS=$(curl -s -o /dev/null -I -w "%{http_code}" $COORD_BASE/v1/entity/$ENTITY -H "x-bbk-auth-token:$BOOTSTRAP_KEY")
    if [[ $STATUS = "404" ]]
    then
        echo "register entity: $ENTITY"
        curl -sS -X POST $COORD_BASE/v1/entity/$ENTITY -H "x-bbk-auth-token:$BOOTSTRAP_KEY" -H "Content-Type: application/json" -d "@entity-$ENTITY.json"
    else
        echo "entity $ENTITY already registered (skipping)"
    fi
}

function register_connector() {
    ENTITY="$1"
    CONNECTOR="$2"
    PORT="$3"
    
    echo "register connector: $CONNECTOR for entity: $ENTITY"

    if [ $HELM_DEPLOY -eq 1 ]; then
        # JSON format for helm deployment
        POSTJSON="{\"name\" : \"$CONNECTOR\", \"description\" : \"Connector $CONNECTOR for entity $ENTITY\", \"webhook\" : \"$WEBHOOK_BASE/$CONNECTOR\", \"cache\": 0}"
    else 
        # JSON format for docker-compose deployment
        POSTJSON="{\"name\" : \"$CONNECTOR\", \"description\" : \"Connector $CONNECTOR for entity $ENTITY\", \"webhook\" : \"$WEBHOOK_BASE:$PORT\", \"cache\": 0}"
    fi
    
    REGISTER_DETAILS=$(curl -sS -X POST $COORD_BASE/v1/entity/$ENTITY/connector/bbk-con-$CONNECTOR -H "x-bbk-auth-token:$BOOTSTRAP_KEY" -H "Content-Type: application/json" -d "$POSTJSON")
    
    echo "take connector live: $CONNECTOR"
    curl -sS -X POST $COORD_BASE/v1/entity/$ENTITY/connector/bbk-con-$CONNECTOR/live -H "x-bbk-auth-token:$BOOTSTRAP_KEY"

    ID=$(echo "$REGISTER_DETAILS" | jq -r '.id')
    TOKEN=$(echo "$REGISTER_DETAILS" | jq -r '.token')
    export BBK_ID_$CONNECTOR="$ID"
    export BBK_TOKEN_$CONNECTOR="$TOKEN"
}

function add_policy () {
    POLICY_SLUG="$1"

    echo "add policy: $POLICY_SLUG"
    curl -X POST $COORD_BASE/v1/policy/$POLICY_SLUG -H "x-bbk-auth-token:$BOOTSTRAP_KEY" -H "Content-Type: application/json" -d "@policy_$POLICY_SLUG.json"

}

function create_policy_user () {
    POLICY_SLUG="$1"
    USER="$POLICY_SLUG-user"

    echo "create consumer user: $USER"
    curl -sS -X POST $COORD_BASE/v1/user -H "x-bbk-auth-token:$BOOTSTRAP_KEY" -H "Content-Type: application/json" -d "{\"name\":\"$USER\",\"email\":\"$USER@domain.com\"}"
}

function create_policy_user_access () {
    POLICY_SLUG="$1"
    USER="$POLICY_SLUG-user"
    EMAIL="$POLICY_SLUG-user@domain.com"

    USERINFO=$(curl -sS -X GET $COORD_BASE/v1/user/email/$EMAIL -H "x-bbk-auth-token:$BOOTSTRAP_KEY")
    USERID=$(echo "$USERINFO" | jq -r '.id')

    echo "give user $USERID ($USER) access to policy $POLICY_SLUG"
    TOKEN="$(curl -sS -X POST $COORD_BASE/v1/user/$USERID/access/$POLICY_SLUG -H "x-bbk-auth-token:$BOOTSTRAP_KEY")"
    EXPORTVAR="BBK_POLICY_TOKEN_$(echo $POLICY_SLUG | tr '-' '_')"
    export "$EXPORTVAR"="$TOKEN"
}

# create country entity & connector

register_entity country 
register_connector country country 8004

# create heritage entity & connectors

register_entity heritage 
register_connector heritage heritagenatural 8005
register_connector heritage heritagecultural 8006

# create polices, users and access

POLICY_LIST=("access-all-areas" "geo-british-isles" "heritage-natural" "pop-hundred-million")

for POLICY_SLUG in ${POLICY_LIST[*]}; do

    add_policy $POLICY_SLUG
    create_policy_user $POLICY_SLUG
    create_policy_user_access $POLICY_SLUG

done
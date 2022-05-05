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
# SPDX-License-Identifier: Apache-2.0

if [ "$#" -ne 2 ]; then
    echo "usage: . ./register-ref-con.sh entity-name connector-name"
else 
    ENTITY="$1"
    CONNECTOR="$2"
    BOOTSTRAP_KEY="abc123"
    echo "register entity $ENTITY"
    curl -sS -X POST http://bbk-coordinator:8001/v1/entity/$ENTITY -H "x-bbk-auth-token:$BOOTSTRAP_KEY" -H "Content-Type: application/json" -d "{\"name\" : \"$ENTITY\", \"description\" : \"$ENTITY sample data\", \"schema\": {}}"
    echo "register connector $CONNECTOR"
    REGISTER_DETAILS=$(curl -sS -X POST http://bbk-coordinator:8001/v1/entity/$ENTITY/connector/bbk-con-$CONNECTOR -H "x-bbk-auth-token:$BOOTSTRAP_KEY" -H "Content-Type: application/json" -d "{\"name\" : \"$CONNECTOR\", \"description\" : \"Connector $CONNECTOR for entity $ENTITY\", \"webhook\" : \"http://$CONNECTOR.con.bbk:8004\", \"cache\": 0}")
    echo "details: $REGISTER_DETAILS"
    echo "take connector $CONNECTOR live"
    curl -sS -X POST http://bbk-coordinator:8001/v1/entity/$ENTITY/connector/bbk-con-$CONNECTOR/live -H "x-bbk-auth-token:$BOOTSTRAP_KEY"
    ID=$(echo "$REGISTER_DETAILS" | jq -r '.id')
    TOKEN=$(echo "$REGISTER_DETAILS" | jq -r '.token')
    export ID_$CONNECTOR="$ID"
    export TOKEN_$CONNECTOR="$TOKEN"
fi
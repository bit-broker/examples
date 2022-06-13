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

# Script to clean up BBK platform instance demo configuration

# To clear BBK env vars set, run: unset $(env | grep BBK_ |awk -F'=' '{print $1}')  

# Variables

WEBHOOK_BASE="http://bbkt-webhook"
COORD_BASE="http://bbk-coordinator:8001"
BOOTSTRAP_KEY="abc123"


# Functions

function delete_entity() {
    ENTITY="$1"

    echo "delete entity: $ENTITY"
    curl -X DELETE $COORD_BASE/v1/entity/$ENTITY -H "x-bbk-auth-token:$BOOTSTRAP_KEY"
}

function delete_policy () {
    POLICY_SLUG="$1"

    echo "delete policy: $POLICY_SLUG"
    curl -X DELETE $COORD_BASE/v1/policy/$POLICY_SLUG -H "x-bbk-auth-token:$BOOTSTRAP_KEY"

}

function delete_policy_user () {
    POLICY_SLUG="$1"
    EMAIL="$POLICY_SLUG-user@domain.com"
    USERINFO=$(curl -sS -X GET $COORD_BASE/v1/user/email/$EMAIL -H "x-bbk-auth-token:$BOOTSTRAP_KEY")
    USERID=$(echo "$USERINFO" | jq -r '.id')
    echo "delete user: $USERID ($EMAIL)"
    curl -X DELETE $COORD_BASE/v1/user/$USERID -H "x-bbk-auth-token:$BOOTSTRAP_KEY"
    
}

# delete entities

delete_entity country 
delete_entity heritage 

# create polices & users

POLICY_LIST=("access-all-areas" "geo-british-isles" "heritage-natural" "pop-hundred-million")

for POLICY_SLUG in ${POLICY_LIST[*]}; do
    delete_policy $POLICY_SLUG
    delete_policy_user $POLICY_SLUG
done
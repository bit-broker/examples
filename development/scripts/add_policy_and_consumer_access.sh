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

# WARNING: this script assumes specific user id's and will only work on a clean BBK deployment.

BOOTSTRAP_KEY="abc123"
COORD_BASE="http://bbk-coordinator:8001"

POLICY_LIST=("access-all-areas" "geo-british-isles" "heritage-natural")

USER_ID=1

for POLICY_SLUG in ${POLICY_LIST[*]}; do

    ((USER_ID++))
    echo "add policy: $POLICY_SLUG"
    curl -X POST $COORD_BASE/v1/policy/$POLICY_SLUG -H "x-bbk-auth-token:$BOOTSTRAP_KEY" -H "Content-Type: application/json" -d "@policy_$POLICY_SLUG.json"
    USER="$POLICY_SLUG-user"
    echo "create consumer user: $USER"
    curl -X POST $COORD_BASE/v1/user -H "x-bbk-auth-token:$BOOTSTRAP_KEY" -H "Content-Type: application/json" -d "{\"name\":\"$USER\",\"email\":\"$USER@domain.com\"}"
    echo "give user $USER access to policy $POLICY_SLUG"
    TOKEN="$(curl -sS -X POST $COORD_BASE/v1/user/$USER_ID/access/$POLICY_SLUG -H "x-bbk-auth-token:$BOOTSTRAP_KEY")"
    echo "user: $USER policy: $POLICY_SLUG token: $TOKEN"

done

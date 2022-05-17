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

BOOTSTRAP_KEY="abc123"
COORD_BASE="http://bbk-coordinator:8001"
echo "add AAA policy"
curl -X POST $COORD_BASE/v1/policy/access-all-areas -H "x-bbk-auth-token:$BOOTSTRAP_KEY" -H "Content-Type: application/json" -d '{"name":"Access All Areas","description":"Global access to every record","policy":{"access_control":{"enabled":true,"quota":{"max_number":86400,"interval_type":"day"},"rate":100},"data_segment":{"segment_query":{},"field_masks":[]},"legal_context":[{"type":"attribution","text":"Data is supplied by Wikipedia","link":"https://en.wikipedia.org/"}]}}'
echo "create consumer user"
curl -X POST $COORD_BASE/v1/user -H "x-bbk-auth-token:$BOOTSTRAP_KEY" -H "Content-Type: application/json" -d '{"name":"bob","email":"bob@domain.com","addendum":{"opaque1":"lorem ipsum","opaque2":"consectetur adipisicing elit","opaque3":"sed do eiusmod tempor incididunt"}}'
echo "give user acess"
TOKEN="$(curl -sS -X POST $COORD_BASE/v1/user/2/access/access-all-areas -H "x-bbk-auth-token:$BOOTSTRAP_KEY")"
echo "AAA consumer token: $TOKEN"
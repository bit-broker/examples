/**
 * Copyright 2022 Cisco and its affiliates
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/*

This file is an example implementation of a data connector posting to a
bbk catalog. Data connector authors can use this class to post updates
to their designated catalog. To instantiate this object you need to
construct it with the following parameters:

cat = the bbk catalog url  - e.g. https://www.foo.bar/v1/
cid = your connector id       - e.g. 40b8fbba-589c-4879-9c30-f4cfd3d4415d
key = your authorization token - e.g. e55816190742ec08e1f735039524b03921c1

If you do not know this information, please contact the controller of your
bbk instance.

*/

'use strict'; // also code assumes ECMAScript 6

// -- dependencies

const fetch = require('node-fetch');

// --- bbk catalog class (exported)

module.exports = class BBKCatalog {
    // --- constructs a bbk catalog object

    constructor(cat, cid, key) {
        this.sid = null; // session id - for later
        this.cid = cid; // connector id
        this.key = key; // auth token
        this.cat = cat.replace(/\/$/, '') + '/connector/' + this.cid + '/session/'; // handles trailing slash or not in cat url
    }

    // --- constants for session types

    static get SESSION_STREAM() { return 'stream'; }
    static get SESSION_ACCRUE() { return 'accrue'; }
    static get SESSION_REPLACE() { return 'replace'; }

    // --- constants for action types

    static get ACTION_DELETE() { return 'delete'; }
    static get ACTION_UPSERT() { return 'upsert'; }

    // --- checks for an error and unpacks it if there

    handleFetchErrors(response) {
        if (!response.ok) {
            return response.text().then(text => { throw new Error(text) })
        }
        return response;
    }

    // --- opens a bbk session of the given type

    open(mode) {
        console.log("open: " + mode);
        return fetch(this.cat + 'open/' + mode, {
                method: 'get',
                headers: {
                    'Content-Type': 'application/json',
                    'x-bbk-auth-token': this.key
                }
            })
        .then(this.handleFetchErrors.bind(this))
        .then(res => res.json())
        .then(json => this.sid = json)
    }

    // --- closes an existing session

    close(commit) {
        console.log("close: " + commit);
        return fetch(this.cat + this.sid + '/close/' + commit, {
                method: 'get',
                headers: {
                    'Content-Type': 'application/json',
                    'x-bbk-auth-token': this.key
                }
            })
        .then(this.handleFetchErrors.bind(this))
    }

    // --- make an action within an active session

    action(actionVerb, items, page) {
        let act = Promise.resolve();
        let url = this.cat + this.sid + '/' + actionVerb;
        for (let start = 0; start < items.length; start += page) {

            // sequential post in batches of 'page' items...
            let end = Math.min(start + page, items.length);
            act = act.then(() => {
                return fetch(url, {
                        method: 'post',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-bbk-auth-token': this.key
                        },
                        body: actionVerb == 'upsert' ? JSON.stringify(items.slice(start, end)) : JSON.stringify(items.slice(start, end).map(i => i.id))
                    })
                .then(this.handleFetchErrors.bind(this))
                .then(res => res.json())
                .then(json => console.log(actionVerb + ": " + Object.keys(json).length + " item(s)"))
            })
        }
        return act
    }

    // --- create a session, make an action, and close the session

    session(mode, actionVerb, items) {
        return this.open(mode)
        .then(response => {
            return this.action(actionVerb, items, 100)
        })
        .then(response => {
            this.close(true)
        })
    }
}

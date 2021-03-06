/**
 * Copyright 2021 Cisco and its affiliates
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
Shared restful CRUD test methods
*/

'use strict'; // code assumes ECMAScript 6

// -- dependancies

const HTTP = require('http-status-codes');
const chakram = require('chakram');
const expect = chakram.expect;

// --- constants

const OK_CODES = [HTTP.OK, HTTP.NO_CONTENT]

// --- crud class (exported)

module.exports = class Crud {

    // --- sets the headers for all future requests

    static headers(headers = {}) {
        chakram.setRequestDefaults ({ headers });
    }

    // --- checks an error response

    static check_error(response, code, errors = []) {
        expect(response.body).to.be.an('object');
        expect(response.body.error).to.be.an('object');
        expect(response.body.error.code).to.be.eq(code);
        expect(response.body.error.status).to.be.eq(HTTP.getReasonPhrase(code));
        expect(response.body.error).to.have.property('message');

        if (errors.length) { // error message should now be an array
            let messages = response.body.error.message;
            expect(messages).to.be.an('array');

            for (let i = 0; i < messages.length; i++) {
                expect(messages[i]).to.have.property('name');
                expect(messages[i]).to.have.property('index');
                expect(messages[i]).to.have.property('reason');
            }
        }

        for (let i = 0; i < errors.length; i++) {
            for (let property in errors[i]) {
                let match = property.match(/\[(\d+)\]/);
                let indexed = match && match.length && match.length > 1;
                let index = indexed ? parseInt(match[1]) : null; // first matching group or null
                let name = indexed ? property.replace(match[0], '') : property;

                let found = response.body.error.message.find(e => {
                    return e.name === name &&
                          (indexed ? e.index === index : true) &&
                           e.reason.toLowerCase().indexOf(errors[i][property]) !== -1;
                });

                expect(found).to.not.be.undefined;
            }
        }

        expect(response).to.have.status(code);
    }

    // --- adds a resource

    static add(url, body, location, checker) {
        return chakram.post(url, body)
        .then(response => {
        //  console.log(response.body?.error);  // debug handy logging
            expect(response).to.have.status(HTTP.CREATED);
            if (location) expect(response).to.have.header('Location', location.trim());
            if (checker) checker(response.body, response.response.headers['location']);
            return chakram.wait();
        });
    }

    // --- attempts to action a duplicate resource

    static duplicate(url, body = undefined, action = chakram.post) {
        return action(url, body)
        .then(response => {
            this.check_error(response, HTTP.CONFLICT);
            return chakram.wait();
        });
    }

    // --- updates a resource

    static update(url, body, checker) {
        return chakram.put(url, body)
        .then(response => {
            expect(response.response.statusCode).to.be.oneOf(OK_CODES);
            if (checker) checker(response.body);
            return chakram.wait();
        });
    }

    // --- deletes a resource

    static delete(url) {
        return chakram.delete(url)
        .then(response => {
            expect(response.body).to.be.undefined;
            expect(response).to.have.status(HTTP.NO_CONTENT);
            return chakram.wait();
        });
    }

    // --- attempts to action a not found resource

    static not_found(url, body = undefined, action = chakram.get) {
        return action(url, body)
        .then(response => {
            this.check_error(response, HTTP.NOT_FOUND);
            return chakram.wait();
        });
    }

    // --- attempts a bad request on a resource

    static bad_request(url, errors, body = undefined, action = chakram.get) {
        return action(url, body)
        .then(response => {
        //  console.log(response.body?.error);  // debug handy logging
            this.check_error(response, HTTP.BAD_REQUEST, errors);
            return chakram.wait();
        });
    }

    // --- attempts a unauthorized request on a resource

    static unauthorized(url, body = undefined, action = chakram.get) {
        return action(url, body)
        .then(response => {
            this.check_error(response, HTTP.UNAUTHORIZED);
            return chakram.wait();
        });
    }

    // --- attempts a forbidden request on a resource

    static forbidden(url, body = undefined, action = chakram.get) {
        return action(url, body)
        .then(response => {
            this.check_error(response, HTTP.FORBIDDEN);
            return chakram.wait();
        });
    }

    // --- a server error state

    static server_error(url, production, error = HTTP.INTERNAL_SERVER_ERROR) {
        return chakram.get(url)
        .then(response => {
            expect(response).to.have.status(error);
            expect(response.body).to.be.an('object');
            expect(response.body.error).to.be.an('object');
            expect(response.body.error.code).to.be.eq(error);
            expect(response.body.error.status).to.be.eq(HTTP.getReasonPhrase(error));
            if (production) expect(response.body.error.message.length).to.be.eq(0); // no error message bodies in production
            return chakram.wait();
        });
    }

    // --- gets a resource

    static get(url, checker) {
        return chakram.get(url)
        .then(response => {
        // if (response.body?.error) console.log(response.body?.error);  // debug handy logging
            expect(response.response.statusCode).to.be.oneOf(OK_CODES);
            if (checker) checker(response.body);
            return chakram.wait();
        });
    }

    // --- check a resource exists

    static exists(url) {
        return chakram.get(url).then(response => OK_CODES.includes(response.response.statusCode));
    }

    // --- post a resource

    static post(url, body, checker) {
        return chakram.post(url, body)
        .then(response => {
            expect(response.response.statusCode).to.be.oneOf(OK_CODES);
            if (checker) checker(response.body);
            return chakram.wait();
        });
    }

    // --- verifies a resource

    static verify(url, resource, include = true) {
        return chakram.get(url)
        .then(response => {
            expect(response.body).to.be.an('object');
            include ? expect(response.body).to.containSubset(resource) : expect(response.body).to.deep.equal(resource);
            expect(response).to.have.status(HTTP.OK);
            return chakram.wait();
        });
    }

    // --- verifies the entire resource list

    static verify_all(url, resources, include = true) {
        resources.sort((a, b) => a.id.toString().localeCompare(b.id.toString(), undefined, {'numeric': true})); // in id order
        return chakram.get(url)
        .then(response => {
         // if (response.body?.error) console.log(response.body?.error);  // debug handy logging
            expect(response.body).to.be.an('array');
            expect(response.body.length).to.be.eq(resources.length);
            for (let i = 0; i < resources.length; i++) {
                include ? expect(response.body[i]).to.containSubset(resources[i]) : expect(response.body[i]).to.deep.equal(resources[i]);
            }
            expect(response).to.have.status(HTTP.OK);
            return chakram.wait();
        });
    }

    // --- adds and then deletes a resource

    static add_del(url, body, resource) {
        return Crud.add(url, body)
        .then (() => Crud.verify(url, resource || body))
        .then (() => Crud.delete(url));
    }

    // --- delete every one of a set of URLs

    static delete_all(urls) {
        let deletes = [];

        for (let i = 0 ; i < urls.length ; i++) {
            deletes.push (this.delete(urls[i]));
        }

        return Promise.all(deletes);
    }
}

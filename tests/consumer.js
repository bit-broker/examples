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
The consumer test harness - use command 'mocha consumer'

This is a simple set of tests using the BBK consumer API to vefify that deployed connectors are working as expected, configured using known data sets.

*/

'use strict'; // code assumes ECMAScript 6

// -- dependancies

const Shared = require('./lib/shared.js');  // include first for dotenv

const URLs = require('./lib/urls.js');
const Crud = require('./lib/crud.js');

const chakram = require('chakram');
const expect = chakram.expect;
const fs = require('fs');

// --- the test cases

describe('Consumer Tests', function() {

    // --- test data

    let entities = JSON.parse(fs.readFileSync('./data/entities.json'));
    let uk = JSON.parse(fs.readFileSync('./data/consumer/uk.json'));
    let ironbridge = JSON.parse(fs.readFileSync('./data/consumer/ironbridge.json'));
    let policy_slug = 'access-all-areas';

    function update_entity_id (entity, id) {
        entity.id = id;
        entity.url = entity.url.replace(':id', id);
        for (const [key, value] of Object.entries(entity.timeseries)) {
            value.url = value.url.replace(':id', id);
        }
    } 

    describe('start up tests', () => {

        it('the server is up', () => {
            return Shared.up(process.env.TESTS_CONSUMER);
        });

        it('it responds to an announce request', () => {
            return Shared.announce(process.env.TESTS_CONSUMER, 'consumer');
        });
    });

    describe('entity tests', () => {

        it('can set the policy header', () => {
            Crud.headers(Shared.policy_header(policy_slug)); // we are not testing policy visibility here - that happens in end2end. Here we just test the api is working and returning he right document.
            return true;
        });

        it('the entity types are all present', () => {
            return Crud.verify_all(URLs.consumer_entity(), entities.map(i => {
                return {
                    id: i.slug,
                    url: URLs.consumer_entity(i.slug),
                    name: i.properties.name,
                    description: i.properties.description
                }
            }));
        });

        it('has the expected number of country entity instances', () => {
            // expect 199 countries
            return Crud.get(`${ URLs.consumer_entity('country') }?limit=200&offset=0`, items => {
                expect(items).to.be.an('array');
                expect(items.length).to.be.eq(199);
                return chakram.wait();
            });
        });

        it('has the expected number of heritage entity instances',() => {
            // expect 1017 heritage sites
            return Crud.get(`${ URLs.consumer_entity('heritage') }?limit=100&offset=1000`, items => {
                expect(items).to.be.an('array');
                expect(items.length).to.be.eq(17);
                return chakram.wait();
            });
        });

        it('has the expected number of heritage cultural category entity instances',() => {
            // expect 814 cultural heritage sites
            return Crud.get(`${ URLs.consumer_catalog({"$and":[{"type":"heritage"},{"entity.category":"cultural"}]})}&limit=100&offset=800`, items => {
                expect(items).to.be.an('array');
                expect(items.length).to.be.eq(14);
                return chakram.wait();
            });
        });

        it('has the expected number of heritage natural category entity instances',() => {
            // expect 203 natural heritage sites
            return Crud.get(`${ URLs.consumer_catalog({"$and":[{"type":"heritage"},{"entity.category":"natural"}]})}&limit=100&offset=200`, items => {
                expect(items).to.be.an('array');
                expect(items.length).to.be.eq(3);
                return chakram.wait();
            });
        });

    });

    describe('entity instance tests', () => {

        it('has all of the expected properties on a country entity instance', () => {

            let type = 'country';
            let id = null;

            return Crud.get(`${ URLs.consumer_catalog({"$and":[{"type":"country"},{"name":"United Kingdom"}]})}`, items => {
                expect(items).to.be.an('array');
                expect(items.length).to.be.eq(1);
                id = items[0].id;
                return chakram.wait();
            }).then(() => {
                update_entity_id(uk, id);
                return Crud.get(URLs.consumer_entity(type, id), body => {
                    expect(body).to.be.an('object');
                    expect(body).to.deep.equal(uk);
                    return chakram.wait();
                });
            }).then(() => {
                update_entity_id(uk, id);
                return Crud.get(URLs.consumer_timeseries(type, id, "population"), items => {
                    expect(items).to.be.an('array');
                    expect(items.length).to.be.eq(58);
                    return chakram.wait();
                });
            });
        });

        it('has all of the expected properties on a heritage entity instance', () => {

            let type = 'heritage';
            let id = null;

            return Crud.get(`${ URLs.consumer_catalog({"$and":[{"type":"heritage"},{"name":"Ironbridge Gorge"}]})}`, items => {
                expect(items).to.be.an('array');
                expect(items.length).to.be.eq(1);
                id = items[0].id;
                return chakram.wait();
            }).then(() => {
                update_entity_id(ironbridge, id);
                ironbridge.entity.country = uk.url;
                return Crud.get(URLs.consumer_entity(type, id), body => {
                    expect(body).to.be.an('object');
                    expect(body).to.deep.equal(ironbridge);
                    return chakram.wait();
                });
            });
        });
    });
});

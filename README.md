# Examples

A set of example BitBroker applications and connectors, with associated data, build and deployment scripts.

## Applications

## Connectors

We have three types of example connector:

- file-based (initial data set loaded from a file)
- REST (all data retrieved from a REST API, with appropriate transformation)
- RDBMS (SQL)

Our initial implementations are node javascript; we aim to expand the range of language implementations in future.

### nodejs-file

Node js file-based data connector.

- initial data set loaded from a file over http
- supports json, xlsx & csv formatted data
- implements catalog session
- implements basic webhook

## Build & Deployment

see [README.MD](./development/scripts/README.MD)

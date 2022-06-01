# Examples

A set of example BitBroker applications and connectors, with associated data, build and deployment scripts.

## Applications

We have the following example apps, both of which allow users to explore policy-based access to data via the BitBroker consumer API:

## Policy-Based data Explorer

This app allows users to choose from a set of pre-defined policies, and to try using different catalog queries in the context of those polices to explore the data that can be accessed.

## Maps

This app allows users to access countries & heritage site data presented in a map context, again according to teh policy selected from a set of pre-defined policies.

## Connectors

We have two types of example connector:

- file-based (initial data set loaded from a file)
- RDBMS (PostGres)

Both implementations fetch and merge 3rd party data in their entity webhooks for the country data set, and both support timeseries data for the country data set.

Our initial implementations are node javascript; we aim to expand the range of language implementations in future.

### nodejs-file

Node js file-based data connector.

- initial data set loaded from a file over http
- supports json, xlsx & csv formatted data
- implements catalog session
- implements entity & timeseries webhooks

### nodejs-RDBMS

PostGreSQL backed data connector.

- initial data set loaded from PostGreSQL
- implements catalog session
- implements entity & timeseries webhooks

## Build & Deployment

This repository includes support for deploying the demo connectirs and apps against a BitBroker deployment, either using Helm or Docker-Compose, with a set of supporting scripts. The Connectos are deplyed supporting two data sets, countries & heritage sites.

see [README.MD](./development/scripts/README.MD)

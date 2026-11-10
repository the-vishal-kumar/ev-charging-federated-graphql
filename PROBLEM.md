# ev-charging-federated-graphql

## Problem Statement

-   Create an application that pulls current charging station data from [Open Charge Map API] and then persists the data in [MongoDB].
    -   Following fields are to be imported from [Open Charge Map API]:
        -   operatorInfo
        -   statusType
        -   addressInfo
        -   connections
-   The service pulls the data and updates the own database. It shall update the database only in case of changes in the pulled data.
-   It is required to use UUIDs (v4) instead of the default ObjectIds internally.
-   Provide a [GraphQL] endpoint which can be queried to pull all imported charging stations. Use [Federated GraphQL] Gateway and Subgraphs.
-   It should be possible to paginate through the list in GraphQL using [relay-style pagination].
-   Each service is to be deployed to a Kubernetes cluster, so shall have a docker image
-   It should be possible to run the whole service and the import locally using a single command.
-   No [NodeJs] frameworks shall be used. e.g NestJS, etc.

## Actions to implement

1.  **Create a [NodeJs] application using [Federated GraphQL]**

1.  **Dockerize the application**

    -   Create multiple Dockerfile(s) for each service, such as Gateway, Socket Subgraph, MongoDB, etc.

1.  **Implement the polling service to fetch data of charging stations**

1.  **Implement a cron job for the polling service to run at a regular interval**

1.  **Create a query to fetch a particular charging station**

1.  **Create a query to fetch relay-style paginated charging stations**

1.  **Write unit and end-to-end tests**

**Note**: Charging stations are being referred to as Socket

## Solution

-   There is one entity - Socket. It represents charging stations in our database.
-   There are two graphql queries - Socket and Sockets.

    [Read more...](./SOLUTION.md)


[nodejs]: https://nodejs.org/en
[open charge map api]: https://openchargemap.org/site/develop/api#/operations/get-poi
[graphql]: https://graphql.org/
[federated graphql]: https://www.apollographql.com/docs/federation/
[relay-style pagination]: https://www.apollographql.com/docs/technotes/TN0029-relay-style-connections/
[mongodb]: https://www.mongodb.com/
# ev-charging-federated-graphql

## Solution

### Problem identification:

-   [Open Charge Map API] is unpaginated.

    -   There are a few important keys that it takes as query parameter:

        -   **key** (_string_) - An API key is a token that you provide when making API calls. It can be sent as the `key` query parameter; this project sends it in the `X-API-Key` header so it does not end up in URLs or logs.
        -   **camelcase** (_boolean_) - Set to true to get a property names in camelCase format. Default `false`.
        -   **maxresults** (_integer_) - Limit on max number of results returned. Default `100`.
        -   **distanceunit** (_string_) - `miles` or `km` distance unit. Default `miles`.
        -   **countrycode** (_string_) - 2-character ISO Country code to filter to one specific country.
        -   **polygon** (_string_) - Filter results within a given Polygon. Specify an encoded polyline for the polygon shape. Polygon will be automatically closed from the last point to the first point.
        -   **boundingbox** (_array_) - Filter results to a given bounding box. Specify top left and bottom right box corners as: (lat,lng),(lat2,lng2)

    -   So now there are two ways to fetch data and populate our own database.

        1.  Whenever a user makes a request to our application to fetch sockets near their location, we query the [Open Charge Map API], fetch data, populate/update our database, and return the response back to user.

            -   Limitations:

                -   We only populate data near the locations of our active customers.
                -   We're making a network request to [Open Charge Map API] every time we get a request to our app. It may be possible that a new user requests data from a new location, and [Open Charge Map API] is down at that moment, so we serve no data to our user.
                -   Our application still has the overhead of updating its own database for any changes in [Open Charge Map API] database.

        1.  We implement a custom solution to pre-fetch all the data from the [Open Charge Map API] by diving the whole world into smaller areas.

            -   Based on the input parameters of the application, there are three ways to fetch smaller data sets:

                1.  Based on **countrycode**

                    -   As per [Countries Now API](https://countriesnow.space/api/v0.1/countries/iso) for fetching countries, there are about 220 countries. So we have a smaller data set, but not small enough.

                1.  Based on **polygon**

                    -   We can further divide each country into cities, get hold of the boundary coordinates (a polygon) of these cities and use these to fetch for data inside these coordinates polygon. It might work, **_but_** where are we going to get accurate boundaries of each city.

                1.  Based on **boundingbox**

                    -   We can think of the (spherical) earth as a 2-D map with latitude as horizontal axis and longitude as vertical axis, and now it is a matter of diving a cartesian plane in as many smaller areas as we like.

                    -   So now we need the boundary coordinates of each country, that is the farthest longitudes and latitudes. So I came across this [stack exchange answer](https://gis.stackexchange.com/a/260612/225830), which had this [Countries of the World] data.

                    -   [parseCountries](./src/subgraphs/socket/src/util/generateCountriesJson.ts) reads the top left and bottom right coordinates of each country from the [cow.txt](./src/subgraphs/socket/src/config/cow.txt) file.

                    -   [generateSubBoundingBoxesOfCountry](./src/subgraphs/socket/src/util/generateSubBoundingBoxesOfCountry.ts) gets sub areas from a bigger area.

                        -   This function takes in the top left and bottom right coordinates (of a country), and an area. Divides the rectangle formed by the top left and bottom right coordinates to smaller rectangles of area less than or equal to given area, and returns the top left and bottom right coordinates of each sub-area. The area is set to 1 square degree (a cell of at most 1° × 1°, roughly 70-110 km a side), which keeps each call bounded; a dense cell can still exceed `maxresults=1000` (see the limitations below).

                        -   This can be then used to make requests for each sub-area, and pre-populate our database.

            -   Limitations:

                -   If there is an update at [Open Charge Map API] in any charging station data, the user will keep receiving an outdated data from our API, till next sync of our application with [Open Charge Map API].

### Implementation

-   There are two main services, i.e. Gateway, and Subgraph(s).
-   Gateway - It is going to stich the schema from different subgraph(s) and provide a single GraphQL url.
-   Subgraph(s) - In the current implementation, we only have one subgraph, i.e. Socket Subgraph.
-   The application runs in a docker container which can be started using a single command.

    -   `compose.yaml` is the entry point of the application (`make up`).
    -   MongoDB is initialized first.
    -   Subgraph(s) start only after MongoDB is healthy. The socket subgraph listens on :4001 and is not published to the host.
    -   Gateway (:4000, the only published port) starts only after the Subgraph(s) are healthy. It composes the schema from the subgraph(s) and provides a single GraphQL url.

-   There is one entity - Socket. It represents a charging station in our database.
-   `Socket` is a federation entity (`@key(fields: "identifier")`) and the schema links Federation v2.5.
-   There are two graphql queries - Socket and Sockets.
-   Socket query

    -   Fetch a particular socket using its `identifier` (the document `_id`). An unknown or malformed id returns a `NOT_FOUND` error.

-   Sockets query

    -   Fetch a list of sockets in a relay-style pagination. A malformed cursor returns `BAD_USER_INPUT`. `totalCount` counts the window after the `after` cursor (or before the `before` cursor).

-   When the app starts/restarts, the `pullSocket` method starts polling from the [Open Charge Map API] immediately (`SOCKET_SYNC_ON_START`, default `true`).
-   A cron-job (`SOCKET_SYNC_SCHEDULE`, default daily at 00:01) also calls `pullSocket` for fetching new data or updating the existing ones.
-   Without `OPEN_CHARGE_MAP_API_KEY` the sync is disabled and the API serves the stored data.

    -   Changes in existing data are updated in our database based on the comparison of the `dateLastStatusUpdate` key.

-   `pullSocket` method in Socket Subgraph

    -   Parses the countries data in memory from [cow.txt](./src/subgraphs/socket/src/config/cow.txt).
    -   Polls data only for the countries listed in `SOCKET_SYNC_COUNTRIES` (default `DE,IN`), which must be members of the `IISOCode` enum.

        -   Only Germany and India are supported for now.

    -   Calls the `generateSubBoundingBoxesOfCountry` method for each enabled country to generate square areas of at most 1 square degree.
    -   Polling happens with respect to each generated sub box, one request at a time. The API key is sent in the `X-API-Key` header.
    -   A new station gets a UUID v4 (`$setOnInsert`); an update never rewrites `_id` or `uuid`.

### See in action

1.  Start the stack (only Docker with the compose plugin is needed).

    ```bash
    make up
    make seed   # optional: 11 sample stations, no API key needed
    ```

1.  Run the tests in containers.

    ```bash
    make test
    ```

1.  Query http://localhost:4000 (Apollo Sandbox in a browser, or any GraphQL client). The schema excerpt:

    ```graphql
    extend schema @link(url: "https://specs.apollo.dev/federation/v2.5", import: ["@key"])

    scalar Date # ISO-8601 string

    type Socket @key(fields: "identifier") {
      identifier: ID!
      serial: Int
      uuid: String!
      operatorInfo: OperatorInfo
      statusType: StatusType
      addressInfo: AddressInfo
      dataProvider: DataProvider
      connections: [Connection]
      dateCreated: Date
      dateLastVerified: Date
      dateLastStatusUpdate: Date
    }

    type Query {
      socket(identifier: String!): Socket
      sockets(after: String, before: String, first: Int, last: Int): SocketConnection!
    }
    ```

1.  Queries:

    ```graphql
    query Socket($identifier: String!) {
      socket(identifier: $identifier) {
        identifier
        serial
        uuid
        dateLastStatusUpdate
        statusType { isOperational title }
        operatorInfo { title websiteURL }
        addressInfo { title town postcode country { isoCode title } latitude longitude }
        connections { id powerKW voltage amps quantity connectionType { formalName title } }
      }
    }

    query Sockets {
      sockets(first: 10) {
        totalCount
        pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
        edges { cursor node { identifier serial uuid addressInfo { title town } } }
      }
    }
    ```

    The nested types (`dataProvider`, `level`, `currentType` and so on) can be selected the same way; the enum types (for example `FormalName`, `LevelTitle`) can be listed with `__type(name: "...") { enumValues { name description } }` outside production.

### Steps to enable more countries

1.  Let's say we want to enable for the `Netherlands`. Its `ISOCode` is `NL`.
1.  Go to [schema.graphql](./src/subgraphs/socket/src/app/node-server/schema.graphql)

    -   Add `NL` to `ISOCode` enum

        ```bash
        enum ISOCode {
            DE
            IN
            NL
        }
        ```

    -   Add `Netherlands` to `CountryTitle` enum

        ```bash 
        enum CountryTitle {
            Germany
            India
            Netherlands
        }
        ```

    -   Since it falls in Europe continent, we do not need to add anything in `ContinentCode` enum

        ```bash
        enum ContinentCode {
            AS
            EU
        }
        ```

1.  Go to [socket](./src/subgraphs/socket/src/type/model/socket.ts) type

    -   Add `NL` to `IISOCode` enum

        ```bash
        export enum IISOCode {
            DE = 'DE',
            IN = 'IN',
            NL = 'NL',
        }
        ```

    -   Add `NETHERLANDS = 'Netherlands',` to `ICountryTitle` enum

        ```bash
        export enum ICountryTitle {
            GERMANY = 'Germany',
            INDIA = 'India',
            NETHERLANDS = 'Netherlands',
        }
        ```

    -   Since it falls in Europe continent, we do not need to add anything in `IContinentCode` enum

        ```bash
        export enum IContinentCode {
            AS = 'AS',
            EU = 'EU',
        }
        ```

1.  Go to [socket](./src/subgraphs/socket/src/model/socket.ts) model

    -   Add `Nl: 'NL',` to `ISOCode` enum

        ```bash
        export const ISOCode = Enum({
            De: 'DE',
            In: 'IN',
            Nl: 'NL',
        });
        ```

    -   Add `Netherlands: 'Netherlands',` to `CountryTitle` enum

        ```bash
        export const CountryTitle = Enum({
            Germany: 'Germany',
            India: 'India',
            Netherlands: 'Netherlands',
        });
        ```

    -   Since it falls in Europe continent, we do not need to add anything in `ContinentCode` enum

        ```bash
        export const ContinentCode = Enum({
            As: 'AS',
            Eu: 'EU',
        });
        ```

1.  Add `NL` to `SOCKET_SYNC_COUNTRIES` (for example `DE,IN,NL`) and restart the application (`make up`); data polling is now enabled for another country.

## Problem Statement

-   Create an application that pulls current charging station data from [Open Charge Map API] and then persists the data in [MongoDB].

    -   Following fields are to be imported from [Open Charge Map API]:

        -   operatorInfo
        -   statusType
        -   addressInfo
        -   connections

-   The service pulls the data and updates the own database. It shall update the database only in case of changes in the pulled data.

    [Read more...](./PROBLEM.md)

### Ambiguity in the problem statement

-   Usage of UUIDs internally

    -   It is understandable to use UUIDs to as client-facing IDs because they're platform-agnostic and are designed to be unique across all systems and time, whereas ObjectIds are generally unique within a single MongoDB instance.
    -   But using it internally makes less sense for following reasons:

        1.  Increased storage size: UUIDs are typically 128 bits (16 bytes) long, whereas ObjectIds are 96 bits (12 bytes).
        1.  Index performance: UUIDs, being longer and less sequential, can impact index performance compared to ObjectIds.

-   [Open Charge Map API] Documentation

    -   It is not accurate. Some keys which are there in the schema are not present in actual response. Some keys present in response are not present in the schema.
    -   Example:

        1.  Socket.DataProvider.DataProviderStatusType.description - there is no such key in actual response.
        1.  Socket.DataProvider.DataProviderStatusType.title - there is no mention of this key in the documentation.

### Limitations of current solution

-   Currently we are polling a maximum of 1000 sockets per sub area of at most 1° × 1°.
-   If there are more than 1000 sockets present in the sub area, then are not polling them.

    -   We can shorten the maximum area of while calculating a sub area.


[MongoDB]: https://mongodb.com/
[Open Charge Map API]: https://openchargemap.org/site/develop/api#/operations/get-poi
[Countries of the World]: https://web.archive.org/web/20150319012353/http://opengeocode.org/cude/download.php?file=/home/fashions/public_html/opengeocode.org/download/cow.txt
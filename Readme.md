# nodeCore - Core insurance system for training

`nodeCore` is a training/concept P&C core platform with a headless API (`apps/core-api`) and a channel UI (`apps/channel-ui`).

Current implemented focus areas:

- Product Management
- Policy Administration
- Billing & Invoicing
- Pricing execution integration
- Ops tooling (search + event streams)

Run demo (backend + frontend) from repo root:

- `bash demo-start.sh`

Then open:

- UI: `http://localhost:3000`
- API: `http://localhost:4000`

Architecture/design guidance is documented in `docs/`.

## A few examples

Simple UI is added just to show the concept. Editing is directly in json text and things are kept simple though, but all concepts, including events are shown

![Initial page](./docs/pictures/overview.png)

Then you can see how the global search looks here

![Search page](./docs/pictures/search.png)

And policies like this currently.

![Policies page](./docs/pictures/policies.png)

And the events page when something is going on

![Events page](./docs/pictures/events.png)

And finally, just a clip of the api json output from the test script

![Api sample](./docs/pictures/apijson.png)

## Architecture and data model outlined

![Architecture](./docs/architecture/core-api-architecture.svg)

![Architecture](./docs/architecture/channel-ui-integration.svg)

![Architecture](./docs/architecture/information-model.svg)

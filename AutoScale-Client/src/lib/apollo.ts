import { ApolloClient, HttpLink, InMemoryCache, split } from "@apollo/client";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { setContext } from "@apollo/client/link/context";
import { getMainDefinition } from "@apollo/client/utilities";
import { createClient } from "graphql-ws";

import { getCookie } from "./cookies";

const httpLink = new HttpLink({
  uri: import.meta.env.VITE_API_URL || "/graphql",
  credentials: "include",
});

const authLink = setContext((_, previousContext) => {
  const csrfToken = getCookie("autoscale_csrf");
  return {
    headers: {
      ...(previousContext.headers || {}),
      ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
    },
  };
});

const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
const wsHost = import.meta.env.VITE_WS_URL || `${wsProtocol}://${window.location.host}/ws`;

const wsLink = new GraphQLWsLink(
  createClient({
    url: wsHost,
    shouldRetry: () => true,
  }),
);

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return definition.kind === "OperationDefinition" && definition.operation === "subscription";
  },
  wsLink,
  authLink.concat(httpLink),
);

export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({
    typePolicies: {
      WorkspaceBoard: {
        keyFields: ["id"],
      },
      InfluencerModel: {
        keyFields: ["id"],
      },
      GeneratedAsset: {
        keyFields: ["id"],
      },
    },
  }),
});
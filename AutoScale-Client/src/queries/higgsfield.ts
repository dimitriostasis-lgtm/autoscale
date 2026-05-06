import { gql } from "@apollo/client";

const HIGGSFIELD_ACCOUNT_FIELDS = gql`
  fragment HiggsfieldAccountFields on HiggsfieldAccountConnection {
    influencerModelId
    influencerModelName
    influencerModelHandle
    connected
    status
    email
    credits
    subscriptionPlanType
    lastCheckedAt
    error
    costTable {
      generationModel
      higgsfieldModelId
      label
      unit
      credits
      resolution
      quality
      notes
    }
  }
`;

export const HIGGSFIELD_ACCOUNT_CONNECTIONS_QUERY = gql`
  query HiggsfieldAccountConnections {
    higgsfieldAccountConnections {
      ...HiggsfieldAccountFields
    }
  }
  ${HIGGSFIELD_ACCOUNT_FIELDS}
`;

export const CONNECT_HIGGSFIELD_ACCOUNT_MUTATION = gql`
  mutation ConnectHiggsfieldAccount($influencerModelId: ID!) {
    connectHiggsfieldAccount(influencerModelId: $influencerModelId) {
      ...HiggsfieldAccountFields
    }
  }
  ${HIGGSFIELD_ACCOUNT_FIELDS}
`;

export const REFRESH_HIGGSFIELD_ACCOUNT_BALANCE_MUTATION = gql`
  mutation RefreshHiggsfieldAccountBalance($influencerModelId: ID!) {
    refreshHiggsfieldAccountBalance(influencerModelId: $influencerModelId) {
      ...HiggsfieldAccountFields
    }
  }
  ${HIGGSFIELD_ACCOUNT_FIELDS}
`;

export const DISCONNECT_HIGGSFIELD_ACCOUNT_MUTATION = gql`
  mutation DisconnectHiggsfieldAccount($influencerModelId: ID!) {
    disconnectHiggsfieldAccount(influencerModelId: $influencerModelId) {
      ...HiggsfieldAccountFields
    }
  }
  ${HIGGSFIELD_ACCOUNT_FIELDS}
`;

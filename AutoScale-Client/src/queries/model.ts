import { gql } from "@apollo/client";

export const BOARD_TAB_FIELDS = gql`
  fragment BoardTabFields on WorkspaceBoard {
    id
    name
    updatedAt
  }
`;

export const INFLUENCER_MODEL_FIELDS = gql`
  fragment InfluencerModelFields on InfluencerModel {
    id
    slug
    name
    handle
    archetype
    description
    avatarImageUrl
    accentFrom
    accentTo
    avatarLabel
    isActive
    assignedAgencyIds
    assignedAgencyNames
    agencyAccessCount
    defaultPlatformWorkflowName
    platformWorkflowCount
    customWorkflowCount
    canAccess
    boardCount
    galleryCount
    outputCount
    defaults {
      generationModel
      resolution
      aspectRatio
      quantity
      promptPrefix
    }
    allowedGenerationModels
    boards {
      ...BoardTabFields
      ownerId
      rows {
        id
        outputAssets {
          id
          influencerModelId
          createdById
          generationModel
          resolution
          quantity
          isSyntheticFailure
          createdAt
        }
      }
    }
  }
  ${BOARD_TAB_FIELDS}
`;

export const INFLUENCER_MODELS_QUERY = gql`
  query InfluencerModels($includeInactive: Boolean = false) {
    influencerModels(includeInactive: $includeInactive) {
      ...InfluencerModelFields
    }
  }
  ${INFLUENCER_MODEL_FIELDS}
`;

export const INFLUENCER_MODEL_QUERY = gql`
  query InfluencerModel($slug: String!) {
    influencerModel(slug: $slug) {
      ...InfluencerModelFields
    }
  }
  ${INFLUENCER_MODEL_FIELDS}
`;

export const CREATE_INFLUENCER_MODEL_MUTATION = gql`
  mutation CreateInfluencerModel($input: CreateInfluencerModelInput!) {
    createInfluencerModel(input: $input) {
      ...InfluencerModelFields
    }
  }
  ${INFLUENCER_MODEL_FIELDS}
`;

export const UPDATE_INFLUENCER_MODEL_PROFILE_MUTATION = gql`
  mutation UpdateInfluencerModelProfile($influencerModelId: ID!, $input: UpdateInfluencerModelProfileInput!) {
    updateInfluencerModelProfile(influencerModelId: $influencerModelId, input: $input) {
      ...InfluencerModelFields
    }
  }
  ${INFLUENCER_MODEL_FIELDS}
`;

export const SET_INFLUENCER_MODEL_AGENCY_ACCESS_MUTATION = gql`
  mutation SetInfluencerModelAgencyAccess($influencerModelId: ID!, $agencyIds: [ID!]!) {
    setInfluencerModelAgencyAccess(influencerModelId: $influencerModelId, agencyIds: $agencyIds) {
      ...InfluencerModelFields
    }
  }
  ${INFLUENCER_MODEL_FIELDS}
`;

export const MODEL_ASSETS_QUERY = gql`
  query ModelAssets($influencerModelId: ID!, $limit: Int) {
    modelAssets(influencerModelId: $influencerModelId, limit: $limit) {
      id
      influencerModelId
      boardId
      rowId
      createdById
      fileName
      filePath
      url
      promptSnapshot
      generationModel
      resolution
      aspectRatio
      quantity
      width
      height
      isSyntheticFailure
      failureLabel
      createdAt
    }
  }
`;
import { gql } from "@apollo/client";

export const USER_FIELDS = gql`
  fragment UserFields on User {
    id
    email
    name
    role
    isActive
    createdAt
    agencyId
    agencyName
    managedAgencyIds
    managedAgencyNames
    managerPermissions {
      canSuspendUsers
      canDeleteUsers
      canResetPasswords
      canManageAssignments
    }
    accessScope
    assignedModelIds
    effectiveModelIds
    lastPasswordResetAt
  }
`;

export const AGENCIES_QUERY = gql`
  query Agencies {
    agencies {
      id
      slug
      name
      createdAt
      memberCount
      adminCount
      managerCount
      userCount
      activeCount
    }
  }
`;

export const CREATE_AGENCY_MUTATION = gql`
  mutation CreateAgency($name: String!) {
    createAgency(name: $name) {
      id
      slug
      name
      createdAt
      memberCount
      adminCount
      userCount
      activeCount
    }
  }
`;

export const RENAME_AGENCY_MUTATION = gql`
  mutation RenameAgency($agencyId: ID!, $name: String!) {
    renameAgency(agencyId: $agencyId, name: $name) {
      id
      slug
      name
      createdAt
      memberCount
      adminCount
      userCount
      activeCount
    }
  }
`;

export const DELETE_AGENCY_MUTATION = gql`
  mutation DeleteAgency($agencyId: ID!) {
    deleteAgency(agencyId: $agencyId)
  }
`;

export const USERS_QUERY = gql`
  query Users {
    users {
      ...UserFields
    }
  }
  ${USER_FIELDS}
`;

export const CREATE_USER_MUTATION = gql`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      ...UserFields
    }
  }
  ${USER_FIELDS}
`;

export const RENAME_USER_MUTATION = gql`
  mutation RenameUser($userId: ID!, $name: String!) {
    renameUser(userId: $userId, name: $name) {
      ...UserFields
    }
  }
  ${USER_FIELDS}
`;

export const UPDATE_USER_ROLE_MUTATION = gql`
  mutation UpdateUserRole($userId: ID!, $role: Role!) {
    updateUserRole(userId: $userId, role: $role) {
      ...UserFields
    }
  }
  ${USER_FIELDS}
`;

export const SET_USER_MODEL_ACCESS_MUTATION = gql`
  mutation SetUserModelAccess($userId: ID!, $influencerModelIds: [ID!]!) {
    setUserModelAccess(userId: $userId, influencerModelIds: $influencerModelIds) {
      ...UserFields
    }
  }
  ${USER_FIELDS}
`;

export const UPDATE_USER_ORGANIZATION_MUTATION = gql`
  mutation UpdateUserOrganization($userId: ID!, $input: UpdateUserOrganizationInput!) {
    updateUserOrganization(userId: $userId, input: $input) {
      ...UserFields
    }
  }
  ${USER_FIELDS}
`;

export const UPDATE_MANAGER_PERMISSIONS_MUTATION = gql`
  mutation UpdateManagerPermissions($userId: ID!, $input: ManagerPermissionsInput!) {
    updateManagerPermissions(userId: $userId, input: $input) {
      ...UserFields
    }
  }
  ${USER_FIELDS}
`;

export const SET_USER_ACTIVE_MUTATION = gql`
  mutation SetUserActive($userId: ID!, $isActive: Boolean!) {
    setUserActive(userId: $userId, isActive: $isActive) {
      ...UserFields
    }
  }
  ${USER_FIELDS}
`;

export const RESET_USER_PASSWORD_MUTATION = gql`
  mutation ResetUserPassword($userId: ID!) {
    resetUserPassword(userId: $userId) {
      temporaryPassword
      user {
        ...UserFields
      }
    }
  }
  ${USER_FIELDS}
`;

export const DELETE_USER_MUTATION = gql`
  mutation DeleteUser($userId: ID!) {
    deleteUser(userId: $userId)
  }
`;
import { gql } from "@apollo/client";

export const ME_QUERY = gql`
  query Me {
    me {
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
        canManageCredits
      }
      accessScope
      assignedModelIds
      effectiveModelIds
      lastPasswordResetAt
    }
  }
`;

export const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      csrfToken
      user {
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
          canManageCredits
        }
        accessScope
        assignedModelIds
        effectiveModelIds
        lastPasswordResetAt
      }
    }
  }
`;

export const LOGOUT_MUTATION = gql`
  mutation Logout {
    logout
  }
`;
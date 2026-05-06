import { gql } from "@apollo/client";

export const BOARD_DETAIL_QUERY = gql`
  query WorkspaceBoard($boardId: ID!) {
    workspaceBoard(boardId: $boardId) {
      id
      influencerModelId
      ownerId
      name
      createdAt
      updatedAt
      owner {
        id
        name
        email
        role
        isActive
        createdAt
        assignedModelIds
      }
      settings {
        generationModel
        resolution
        poseMultiplierResolution
        videoDurationSeconds
        quality
        aspectRatio
        quantity
        sdxlWorkspaceMode
        poseMultiplierEnabled
        poseMultiplier
        poseMultiplierGenerationModel
        upscale
        upscaleFactor
        upscaleDenoise
        faceSwap
        faceSwapModelStrength
        autoPromptGen
        autoPromptImage
        posePromptMode
        posePromptTemplate
        posePromptTemplates
        globalReferences {
          id
          slotIndex
          label
          sourceType
          assetId
          assetUrl
          uploadPath
          uploadUrl
          asset {
            id
            url
            fileName
            promptSnapshot
            createdAt
            isSyntheticFailure
            failureLabel
          }
        }
      }
      rows {
        id
        orderIndex
        label
        prompt
        poseMultiplier
        posePromptTemplates
        upscale
        faceSwap
        status
        errorMessage
        lastRunAt
        reference {
          id
          slotIndex
          label
          sourceType
          assetId
          assetUrl
          uploadPath
          uploadUrl
          asset {
            id
            url
            fileName
            promptSnapshot
            createdAt
            isSyntheticFailure
            failureLabel
          }
        }
        audioReference {
          id
          slotIndex
          label
          sourceType
          assetId
          assetUrl
          uploadPath
          uploadUrl
          asset {
            id
            url
            fileName
            promptSnapshot
            createdAt
            isSyntheticFailure
            failureLabel
          }
        }
        outputAssets {
          id
          url
          fileName
          promptSnapshot
          createdAt
          width
          height
          workflowStage
          mediaKind
          galleryMode
          storageNamespace
          isSyntheticFailure
          failureLabel
        }
        poseOutputAssets {
          id
          url
          fileName
          promptSnapshot
          createdAt
          width
          height
          workflowStage
          mediaKind
          galleryMode
          storageNamespace
          isSyntheticFailure
          failureLabel
        }
        faceSwapOutputAssets {
          id
          url
          fileName
          promptSnapshot
          createdAt
          width
          height
          workflowStage
          mediaKind
          galleryMode
          storageNamespace
          isSyntheticFailure
          failureLabel
        }
      }
    }
  }
`;

export const ENSURE_BOARD_MUTATION = gql`
  mutation EnsureBoard($influencerModelId: ID!) {
    ensureBoard(influencerModelId: $influencerModelId) {
      id
      name
      updatedAt
    }
  }
`;

export const CREATE_BOARD_MUTATION = gql`
  mutation CreateBoard($influencerModelId: ID!, $name: String, $sourceBoardId: ID) {
    createBoard(influencerModelId: $influencerModelId, name: $name, sourceBoardId: $sourceBoardId) {
      id
      name
      updatedAt
    }
  }
`;

export const DELETE_BOARD_MUTATION = gql`
  mutation DeleteBoard($boardId: ID!) {
    deleteBoard(boardId: $boardId)
  }
`;

export const ADD_ROW_MUTATION = gql`
  mutation AddBoardRow($boardId: ID!) {
    addBoardRow(boardId: $boardId) {
      id
      updatedAt
    }
  }
`;

export const DELETE_ROW_MUTATION = gql`
  mutation DeleteBoardRow($boardId: ID!, $rowId: ID!) {
    deleteBoardRow(boardId: $boardId, rowId: $rowId) {
      id
      updatedAt
    }
  }
`;

export const UPDATE_ROW_MUTATION = gql`
  mutation UpdateBoardRow($input: UpdateBoardRowInput!) {
    updateBoardRow(input: $input) {
      id
      updatedAt
    }
  }
`;

export const UPDATE_SETTINGS_MUTATION = gql`
  mutation UpdateBoardSettings($boardId: ID!, $input: BoardSettingsInput!) {
    updateBoardSettings(boardId: $boardId, input: $input) {
      id
      updatedAt
    }
  }
`;

export const CLEAR_BOARD_MUTATION = gql`
  mutation ClearBoard($boardId: ID!) {
    clearBoard(boardId: $boardId) {
      id
      updatedAt
    }
  }
`;

export const RUN_BOARD_MUTATION = gql`
  mutation RunBoard($boardId: ID!) {
    runBoard(boardId: $boardId) {
      id
      updatedAt
    }
  }
`;

export const BOARD_UPDATED_SUBSCRIPTION = gql`
  subscription BoardUpdated($boardId: ID!) {
    boardUpdated(boardId: $boardId) {
      id
      influencerModelId
      ownerId
      name
      createdAt
      updatedAt
      owner {
        id
        name
        email
        role
        isActive
        createdAt
        assignedModelIds
      }
      settings {
        generationModel
        resolution
        poseMultiplierResolution
        videoDurationSeconds
        quality
        aspectRatio
        quantity
        sdxlWorkspaceMode
        poseMultiplierEnabled
        poseMultiplier
        poseMultiplierGenerationModel
        upscale
        upscaleFactor
        upscaleDenoise
        faceSwap
        faceSwapModelStrength
        autoPromptGen
        autoPromptImage
        posePromptMode
        posePromptTemplate
        posePromptTemplates
        globalReferences {
          id
          slotIndex
          label
          sourceType
          assetId
          assetUrl
          uploadPath
          uploadUrl
          asset {
            id
            url
            fileName
            promptSnapshot
            createdAt
            isSyntheticFailure
            failureLabel
          }
        }
      }
      rows {
        id
        orderIndex
        label
        prompt
        poseMultiplier
        posePromptTemplates
        upscale
        faceSwap
        status
        errorMessage
        lastRunAt
        reference {
          id
          slotIndex
          label
          sourceType
          assetId
          assetUrl
          uploadPath
          uploadUrl
          asset {
            id
            url
            fileName
            promptSnapshot
            createdAt
            isSyntheticFailure
            failureLabel
          }
        }
        audioReference {
          id
          slotIndex
          label
          sourceType
          assetId
          assetUrl
          uploadPath
          uploadUrl
          asset {
            id
            url
            fileName
            promptSnapshot
            createdAt
            isSyntheticFailure
            failureLabel
          }
        }
        outputAssets {
          id
          url
          fileName
          promptSnapshot
          createdAt
          width
          height
          workflowStage
          mediaKind
          galleryMode
          storageNamespace
          isSyntheticFailure
          failureLabel
        }
        poseOutputAssets {
          id
          url
          fileName
          promptSnapshot
          createdAt
          width
          height
          workflowStage
          mediaKind
          galleryMode
          storageNamespace
          isSyntheticFailure
          failureLabel
        }
        faceSwapOutputAssets {
          id
          url
          fileName
          promptSnapshot
          createdAt
          width
          height
          workflowStage
          mediaKind
          galleryMode
          storageNamespace
          isSyntheticFailure
          failureLabel
        }
      }
    }
  }
`;

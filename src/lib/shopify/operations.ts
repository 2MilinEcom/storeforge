export const LIST_THEMES = `#graphql
query StoreForgeThemes {
  themes(first: 40) {
    nodes { id name role prefix processing processingFailed }
  }
}`;

export const DUPLICATE_THEME = `#graphql
mutation StoreForgeDuplicateTheme($id: ID!, $name: String!) {
  themeDuplicate(id: $id, name: $name) {
    newTheme { id name role prefix processing processingFailed }
    userErrors { field message }
  }
}`;

export const THEME_FILES = `#graphql
query StoreForgeThemeFiles($id: ID!, $filenames: [String!]!) {
  theme(id: $id) {
    id name
    files(first: 30, filenames: $filenames) {
      edges { node { filename body { ... on OnlineStoreThemeFileBodyText { content } } } }
      userErrors { code filename }
    }
  }
}`;

export const UPSERT_THEME_FILES = `#graphql
mutation StoreForgeUpsertThemeFiles($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
  themeFilesUpsert(themeId: $themeId, files: $files) {
    upsertedThemeFiles { filename }
    job { id }
    userErrors { field message }
  }
}`;

export const STAGE_UPLOADS = `#graphql
mutation StoreForgeStageUploads($input: [StagedUploadInput!]!) {
  stagedUploadsCreate(input: $input) {
    stagedTargets { url resourceUrl parameters { name value } }
    userErrors { field message }
  }
}`;

export const CREATE_FILES = `#graphql
mutation StoreForgeCreateFiles($files: [FileCreateInput!]!) {
  fileCreate(files: $files) {
    files {
      id fileStatus alt
      ... on Video { filename originalSource { url } sources { url format height width mimeType } preview { image { url } } }
      ... on MediaImage { image { url } }
    }
    userErrors { field message }
  }
}`;

export const CREATE_THEME = `#graphql
mutation StoreForgeThemeCreate($name: String!, $source: URL!) {
  themeCreate(name: $name, source: $source) {
    theme { id name role prefix processing processingFailed }
    userErrors { code field message }
  }
}`;

export const PRODUCT_SET = `#graphql
mutation StoreForgeProductSet($input: ProductSetInput!, $identifier: ProductSetIdentifiers, $synchronous: Boolean!) {
  productSet(input: $input, identifier: $identifier, synchronous: $synchronous) {
    product { id title handle templateSuffix status }
    userErrors { code field message }
  }
}`;

export const UPDATE_PRODUCT_TEMPLATE = `#graphql
mutation StoreForgeProductTemplate($product: ProductUpdateInput!) {
  productUpdate(product: $product) {
    product { id title handle templateSuffix }
    userErrors { field message }
  }
}`;

export const FILE_STATUS = `#graphql
query StoreForgeFileStatus($id: ID!) {
  node(id: $id) {
    id
    ... on File { fileStatus }
    ... on Video { filename originalSource { url } sources { url format height width mimeType } preview { image { url } } }
    ... on MediaImage { image { url } }
  }
}`;

export const PUBLICATIONS = `#graphql
query StoreForgePublications {
  publications(first: 20) {
    nodes { id catalog { title } }
  }
}`;

export const PUBLISH_PRODUCT = `#graphql
mutation StoreForgePublishProduct($id: ID!, $input: [PublicationInput!]!) {
  publishablePublish(id: $id, input: $input) {
    publishable { ... on Product { id title } }
    userErrors { field message }
  }
}`;

export const THEME_STATUS = `#graphql
query StoreForgeThemeStatus($id: ID!) {
  theme(id: $id) { id name processing processingFailed }
}`;

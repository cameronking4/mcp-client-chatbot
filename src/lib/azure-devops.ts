/**
 * Azure DevOps client for interacting with Azure DevOps REST API
 * 
 * This client handles authentication and provides methods for interacting with
 * work items, queries, repositories, and other Azure DevOps resources.
 */
// Define interfaces for Azure DevOps entities
export interface WorkItem {
  id: number;
  rev: number;
  fields: Record<string, any>;
  relations?: WorkItemRelation[];
  url: string;
}

export interface WorkItemRelation {
  rel: string;
  url: string;
  attributes: {
    name?: string;
    [key: string]: any;
  };
}

export interface WorkItemQueryResult {
  queryType: string;
  queryResultType: string;
  asOf: string;
  columns?: Array<{ name: string; referenceName: string; url: string }>;
  workItems?: Array<{ id: number; url: string }>;
  workItemRelations?: Array<{
    rel: string;
    source?: { id: number; url: string };
    target: { id: number; url: string };
  }>;
}

export interface WorkItemQuery {
  id: string;
  name: string;
  path: string;
  wiql: string;
  isFolder: boolean;
  isPublic?: boolean;
  url: string;
  children?: WorkItemQuery[];
}

export interface GitRepository {
  id: string;
  name: string;
  url: string;
  defaultBranch: string;
  size: number;
  remoteUrl: string;
  webUrl: string;
}

export interface GitRef {
  name: string;
  objectId: string;
  url: string;
}

export interface GitCommit {
  commitId: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  committer: {
    name: string;
    email: string;
    date: string;
  };
  comment: string;
  url: string;
}

export interface GitPullRequest {
  pullRequestId: number;
  title: string;
  description?: string;
  status: string;
  sourceRefName: string;
  targetRefName: string;
  mergeStatus: string;
  isDraft: boolean;
  createdBy: {
    displayName: string;
    id: string;
    uniqueName: string;
    imageUrl: string;
  };
  creationDate: string;
  url: string;
  repository: {
    id: string;
    name: string;
    url: string;
  };
}

export interface GitItem {
  objectId: string;
  gitObjectType: string;
  commitId: string;
  path: string;
  isFolder: boolean;
  url: string;
  content?: string;
  contentMetadata?: {
    fileName: string;
    extension: string;
    contentType: string;
    encoding?: string;
  };
}

export interface GitChange {
  changeType: 'add' | 'edit' | 'delete';
  item: {
    path: string;
  };
  newContent?: {
    content: string;
    contentType: 'rawtext' | 'base64encoded';
  };
}

export interface GitPush {
  pushId: number;
  repository: {
    id: string;
    name: string;
    url: string;
  };
  commits: GitCommit[];
  refUpdates: Array<{
    name: string;
    oldObjectId: string;
    newObjectId: string;
  }>;
  url: string;
}

export class AzureDevOpsClient {
  private pat: string;
  private project: string;
  private apiVersion: string;
  private baseUrl: string;

  constructor(
    pat: string,
    organization: string,
    project: string,
    apiVersion: string = '6.0'  // Changed to 6.0 which is more widely supported
  ) {
    this.pat = pat;
    this.project = project;
    this.apiVersion = apiVersion;
    this.baseUrl = `https://dev.azure.com/${organization}/${project}/_apis`;
    
    console.log(`Azure DevOps client initialized for organization: ${organization}, project: ${project}`);
  }

  /**
   * Create authorization header with PAT
   */
  private getAuthHeader(): { Authorization: string } {
    const token = Buffer.from(`:${this.pat}`).toString('base64');
    return { Authorization: `Basic ${token}` };
  }

  /**
   * Make a request to the Azure DevOps API
   */
  private async request<T>(
    method: string,
    path: string,
    body?: any,
    additionalParams: Record<string, string> = {}
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    
    // Add API version
    url.searchParams.append('api-version', this.apiVersion);
    
    // Add additional query parameters
    Object.entries(additionalParams).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, value);
      }
    });

    const headers: Record<string, string> = {
      ...this.getAuthHeader(),
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    };

    console.log(`Making Azure DevOps API request: ${method} ${url.toString()}`);
    
    try {
      const response = await fetch(url.toString(), options);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Azure DevOps API error (${response.status}): ${errorText}`);
        console.error(`Request URL: ${url.toString()}`);
        console.error(`Request method: ${method}`);
        throw new Error(`Azure DevOps API error (${response.status}): ${errorText}`);
      }
      
      return await response.json() as T;
    } catch (error: any) {
      console.error(`Error in Azure DevOps API request to ${path}:`, error);
      throw new Error(`Azure DevOps API request failed: ${error.message}`);
    }
  }

  // ==================== Work Item Methods ====================

  /**
   * Get a work item by ID
   */
  async getWorkItem(id: number, includeRelations: boolean = true): Promise<WorkItem> {
    const expand = includeRelations ? 'relations' : '';
    return this.request<WorkItem>(
      'GET',
      `/wit/workitems/${id}`,
      undefined,
      { expand }
    );
  }

  /**
   * Create a new work item
   */
  async createWorkItem(
    workItemType: string,
    fields: Record<string, any>,
    relations?: WorkItemRelation[]
  ): Promise<WorkItem> {
    const operations = [
      // Add field operations
      ...Object.entries(fields).map(([key, value]) => ({
        op: 'add',
        path: `/fields/${key}`,
        value,
      })),
      
      // Add relation operations if provided
      ...(relations || []).map(relation => ({
        op: 'add',
        path: '/relations/-',
        value: relation,
      })),
    ];

    return this.request<WorkItem>(
      'POST',
      `/wit/workitems/$${workItemType}`,
      operations,
      { 'validateOnly': 'false' }
    );
  }

  /**
   * Update an existing work item
   */
  async updateWorkItem(
    id: number,
    fields: Record<string, any>,
    relations?: { add?: WorkItemRelation[], remove?: string[] }
  ): Promise<WorkItem> {
    const operations = [
      // Add field operations
      ...Object.entries(fields).map(([key, value]) => ({
        op: 'add',
        path: `/fields/${key}`,
        value,
      })),
      
      // Add relation operations if provided
      ...(relations?.add || []).map(relation => ({
        op: 'add',
        path: '/relations/-',
        value: relation,
      })),
      
      // Remove relation operations if provided
      ...(relations?.remove || []).map(relationUrl => ({
        op: 'remove',
        path: `/relations/${relationUrl}`,
      })),
    ];

    return this.request<WorkItem>(
      'PATCH',
      `/wit/workitems/${id}`,
      operations
    );
  }

  /**
   * Query work items using WIQL
   */
  async queryWorkItems(wiqlQuery: string | { query: string }, top?: number, skip?: number): Promise<WorkItemQueryResult> {
    // Ensure the query is properly formatted as an object with a 'query' property
    const body = typeof wiqlQuery === 'string' ? { query: wiqlQuery } : wiqlQuery;
    
    console.log(`WIQL query body: ${JSON.stringify(body)}`);
    
    const params: Record<string, string> = {};
    if (top !== undefined) params['$top'] = top.toString();
    if (skip !== undefined) params['$skip'] = skip.toString();
    
    return this.request<WorkItemQueryResult>(
      'POST',
      '/wit/wiql',
      body,
      params
    );
  }

  /**
   * Get work items by IDs
   */
  async getWorkItemsByIds(ids: number[], fields?: string[]): Promise<WorkItem[]> {
    if (ids.length === 0) return [];
    
    // Limit the number of IDs per request to avoid URL length limitations
    // Azure DevOps API typically has a limit of around 200 IDs per request
    const maxIdsPerRequest = 100;
    const idBatches: number[][] = [];
    
    for (let i = 0; i < ids.length; i += maxIdsPerRequest) {
      idBatches.push(ids.slice(i, i + maxIdsPerRequest));
    }
    
    console.log(`Fetching ${ids.length} work items in ${idBatches.length} batches`);
    
    const allWorkItems: WorkItem[] = [];
    
    for (const batch of idBatches) {
      const params: Record<string, string> = {};
      if (fields && fields.length > 0) {
        params['fields'] = fields.join(',');
      }
      
      try {
        const batchWorkItems = await this.request<{ value: WorkItem[] }>(
          'GET',
          `/wit/workitems?ids=${batch.join(',')}`,
          undefined,
          params
        ).then(response => response.value);
        
        allWorkItems.push(...batchWorkItems);
      } catch (error) {
        console.error(`Error fetching batch of work items: ${error}`);
        // Continue with other batches even if one fails
      }
    }
    
    return allWorkItems;
  }

  // ==================== Work Item Query Methods ====================

  /**
   * List work item queries
   */
  async listWorkItemQueries(path?: string, depth: number = 1, includeDeleted: boolean = false): Promise<WorkItemQuery[]> {
    const params: Record<string, string> = {
      'depth': depth.toString(),
      'includeDeleted': includeDeleted.toString(),
    };
    
    if (path) {
      params['path'] = path;
    }
    
    return this.request<{ value: WorkItemQuery[] }>(
      'GET',
      '/wit/queries',
      undefined,
      params
    ).then(response => response.value);
  }

  /**
   * Create a work item query
   */
  async createWorkItemQuery(
    name: string,
    wiqlQuery: string,
    path: string,
    isPublic: boolean = true
  ): Promise<WorkItemQuery> {
    const body = {
      name,
      wiql: wiqlQuery,
      isPublic,
    };
    
    return this.request<WorkItemQuery>(
      'POST',
      `/wit/queries${path}`,
      body
    );
  }

  /**
   * Get a work item query by ID
   */
  async getWorkItemQuery(queryId: string): Promise<WorkItemQuery> {
    return this.request<WorkItemQuery>(
      'GET',
      `/wit/queries/${queryId}`
    );
  }

  /**
   * Run a saved work item query
   */
  async runSavedQuery(queryId: string, top?: number, skip?: number): Promise<WorkItemQueryResult> {
    const params: Record<string, string> = {};
    if (top !== undefined) params['$top'] = top.toString();
    if (skip !== undefined) params['$skip'] = skip.toString();
    
    // Try different approaches to access the query
    try {
      console.log(`Attempting to run saved query with ID: ${queryId}`);
      
      // First try: Use the standard endpoint
      return await this.request<WorkItemQueryResult>(
        'GET',
        `/wit/queries/${queryId}/wiql`,
        undefined,
        params
      );
    } catch (error: any) {
      console.log(`Standard query endpoint failed: ${error.message}`);
      
      // Second try: If the query ID contains slashes, it might be a path
      if (queryId.includes('/')) {
        try {
          console.log(`Query ID contains slashes, trying to get query by path: ${queryId}`);
          
          // List queries to find the one with the matching path
          const queries = await this.listWorkItemQueries(undefined, 4, false);
          console.log(`Found ${queries.length} queries`);
          
          // Find the query with the matching path
          const matchingQuery = queries.find(q => 
            q.path.toLowerCase().includes(queryId.toLowerCase()) || 
            q.name.toLowerCase() === queryId.toLowerCase()
          );
          
          if (matchingQuery) {
            console.log(`Found matching query: ${matchingQuery.name} (${matchingQuery.id})`);
            return await this.request<WorkItemQueryResult>(
              'GET',
              `/wit/queries/${matchingQuery.id}/wiql`,
              undefined,
              params
            );
          }
        } catch (pathError: any) {
          console.error(`Error finding query by path: ${pathError.message}`);
        }
      }
      
      // Third try: Try to run a direct WIQL query
      try {
        console.log(`Attempting to get query definition for ID: ${queryId}`);
        
        // Try to get the query definition
        const query = await this.getWorkItemQuery(queryId);
        console.log(`Found query: ${query.name} with WIQL: ${query.wiql}`);
        
        // Run the WIQL query directly
        return await this.queryWorkItems(query.wiql, top, skip);
      } catch (wiqlError: any) {
        console.error(`Error getting query definition: ${wiqlError.message}`);
        
        // Fourth try: Try a different API endpoint format
        try {
          console.log(`Trying alternative query endpoint format...`);
          return await this.request<WorkItemQueryResult>(
            'GET',
            `/_apis/wit/queries/${queryId}`,
            undefined,
            { ...params, 'includeContent': 'true' }
          );
        } catch (altError: any) {
          console.error(`Alternative query endpoint failed: ${altError.message}`);
          throw error; // Throw the original error
        }
      }
    }
  }

  // ==================== Git Repository Methods ====================

  /**
   * List Git repositories
   */
  async listRepositories(): Promise<GitRepository[]> {
    return this.request<{ value: GitRepository[] }>(
      'GET',
      '/git/repositories'
    ).then(response => response.value);
  }

  /**
   * Get a Git repository by ID
   */
  async getRepository(repositoryId: string): Promise<GitRepository> {
    return this.request<GitRepository>(
      'GET',
      `/git/repositories/${repositoryId}`
    );
  }

  /**
   * Create a new branch
   */
  async createBranch(
    repositoryId: string,
    branchName: string,
    baseBranchName: string
  ): Promise<GitRef> {
    // First, get the object ID of the base branch
    const baseRef = await this.request<GitRef>(
      'GET',
      `/git/repositories/${repositoryId}/refs?filter=${encodeURIComponent(baseBranchName)}`
    );
    
    if (!baseRef) {
      throw new Error(`Base branch ${baseBranchName} not found`);
    }
    
    // Create the new branch
    const body = {
      name: branchName.startsWith('refs/') ? branchName : `refs/heads/${branchName}`,
      oldObjectId: '0000000000000000000000000000000000000000',
      newObjectId: baseRef.objectId,
    };
    
    return this.request<{ value: GitRef[] }>(
      'POST',
      `/git/repositories/${repositoryId}/refs`,
      [body]
    ).then(response => response.value[0]);
  }

  /**
   * Commit changes to a branch
   */
  async commitChanges(
    repositoryId: string,
    branchName: string,
    changes: GitChange[],
    commitMessage: string
  ): Promise<GitPush> {
    // Get the current branch ref
    const branchRefName = branchName.startsWith('refs/') ? branchName : `refs/heads/${branchName}`;
    const branchRef = await this.request<{ value: GitRef[] }>(
      'GET',
      `/git/repositories/${repositoryId}/refs?filter=${encodeURIComponent(branchRefName)}`
    ).then(response => response.value[0]);
    
    if (!branchRef) {
      throw new Error(`Branch ${branchName} not found`);
    }
    
    // Create the push with changes
    const body = {
      refUpdates: [
        {
          name: branchRefName,
          oldObjectId: branchRef.objectId,
        },
      ],
      commits: [
        {
          comment: commitMessage,
          changes: changes,
        },
      ],
    };
    
    return this.request<GitPush>(
      'POST',
      `/git/repositories/${repositoryId}/pushes`,
      body
    );
  }

  /**
   * Create a pull request
   */
  async createPullRequest(
    repositoryId: string,
    sourceBranch: string,
    targetBranch: string,
    title: string,
    description?: string,
    reviewers?: string[]
  ): Promise<GitPullRequest> {
    const sourceRefName = sourceBranch.startsWith('refs/') ? sourceBranch : `refs/heads/${sourceBranch}`;
    const targetRefName = targetBranch.startsWith('refs/') ? targetBranch : `refs/heads/${targetBranch}`;
    
    const body: any = {
      sourceRefName,
      targetRefName,
      title,
      description,
    };
    
    if (reviewers && reviewers.length > 0) {
      body.reviewers = reviewers.map(id => ({ id }));
    }
    
    return this.request<GitPullRequest>(
      'POST',
      `/git/repositories/${repositoryId}/pullrequests`,
      body
    );
  }

  /**
   * List files in a repository
   */
  async listFiles(
    repositoryId: string,
    path: string = '/',
    branchName?: string,
    recursionLevel: 'none' | 'oneLevel' | 'full' = 'oneLevel'
  ): Promise<GitItem[]> {
    const params: Record<string, string> = {
      'recursionLevel': recursionLevel,
    };
    
    if (branchName) {
      params['versionDescriptor.version'] = branchName;
      params['versionDescriptor.versionType'] = 'branch';
    }
    
    return this.request<{ value: GitItem[] }>(
      'GET',
      `/git/repositories/${repositoryId}/items`,
      undefined,
      { ...params, 'scopePath': path }
    ).then(response => response.value);
  }

  /**
   * Read a file from a repository
   */
  async readFile(
    repositoryId: string,
    filePath: string,
    branchName?: string
  ): Promise<GitItem> {
    const params: Record<string, string> = {
      'path': filePath,
      'includeContent': 'true',
    };
    
    if (branchName) {
      params['versionDescriptor.version'] = branchName;
      params['versionDescriptor.versionType'] = 'branch';
    }
    
    return this.request<GitItem>(
      'GET',
      `/git/repositories/${repositoryId}/items`,
      undefined,
      params
    );
  }
}

// Export a function to create the client from environment variables
export function createAzureDevOpsClient(): AzureDevOpsClient {
  const pat = process.env.AZURE_DEVOPS_PAT;
  const organization = process.env.AZURE_DEVOPS_ORGANIZATION;
  const project = process.env.AZURE_DEVOPS_PROJECT;
  
  if (!pat || !organization || !project) {
    throw new Error('Azure DevOps configuration is missing. Please set AZURE_DEVOPS_PAT, AZURE_DEVOPS_ORGANIZATION, and AZURE_DEVOPS_PROJECT environment variables.');
  }
  
  return new AzureDevOpsClient(pat, organization, project);
}

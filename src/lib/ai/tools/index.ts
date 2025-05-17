import { createPieChartTool } from "./create-pie-chart";
import { createBarChartTool } from "./create-bar-chart";
import { createLineChartTool } from "./create-line-chart";
import { parseDataTool } from "./parse-data";
import { analyzeDataTool } from "./analyze-data";
import { filterDataTool } from "./filter-data";
import { exportDataTool } from "./export-data";
import { enrichDataTool } from "./enrich-data";
import { searchDataTool } from "./search-data";
import { computeDataTool } from "./compute-data";
// Azure Storage tools
import { azureListFilesTool } from "./azure-list-files";
import { azureSearchFilesTool } from "./azure-search-files";
import { azureDeleteFileTool } from "./azure-delete-file";
import { azureUploadFileTool } from "./azure-upload-file";
import { azureImportFileTool } from "./azure-import-file";
// File creation tool
import { createDownloadableFileTool } from "./create-downloadable-file";
// Memory tools
import { memorySetTool, memoryGetTool, memoryDeleteTool, memoryListTool } from "./memory-tools";
// Azure DevOps Work Item tools
import { azureDevOpsGetWorkItemTool } from "./azure-devops-get-work-item";
import { azureDevOpsUpdateWorkItemTool } from "./azure-devops-update-work-item";
import { azureDevOpsCreateWorkItemTool } from "./azure-devops-create-work-item";
import { azureDevOpsQueryWorkItemsTool } from "./azure-devops-query-work-items";
import { azureDevOpsListWorkItemQueriesTool } from "./azure-devops-list-work-item-queries";
import { azureDevOpsCreateWorkItemQueryTool } from "./azure-devops-create-work-item-query";
import { azureDevOpsRunSavedQueryTool } from "./azure-devops-run-saved-query";
// Azure DevOps Repository tools
import { azureDevOpsCreateBranchTool } from "./azure-devops-create-branch";
import { azureDevOpsCommitChangesTool } from "./azure-devops-commit-changes";
import { azureDevOpsCreatePRTool } from "./azure-devops-create-pr";
import { azureDevOpsListFilesTool } from "./azure-devops-list-files";
import { azureDevOpsReadFileTool } from "./azure-devops-read-file";
import { DefaultToolName } from "./utils";

export const defaultTools = {
  [DefaultToolName.CreatePieChart]: createPieChartTool,
  [DefaultToolName.CreateBarChart]: createBarChartTool,
  [DefaultToolName.CreateLineChart]: createLineChartTool,
  [DefaultToolName.ParseData]: parseDataTool,
  [DefaultToolName.AnalyzeData]: analyzeDataTool,
  [DefaultToolName.FilterData]: filterDataTool,
  [DefaultToolName.ExportData]: exportDataTool,
  [DefaultToolName.EnrichData]: enrichDataTool,
  [DefaultToolName.SearchData]: searchDataTool,
  [DefaultToolName.ComputeData]: computeDataTool,
  // Azure Storage tools
  [DefaultToolName.AzureListFiles]: azureListFilesTool,
  [DefaultToolName.AzureSearchFiles]: azureSearchFilesTool,
  [DefaultToolName.AzureDeleteFile]: azureDeleteFileTool,
  [DefaultToolName.AzureUploadFile]: azureUploadFileTool,
  [DefaultToolName.AzureImportFile]: azureImportFileTool,
  // File creation tool
  [DefaultToolName.CreateDownloadableFile]: createDownloadableFileTool,
  // Memory tools
  [DefaultToolName.MemorySet]: memorySetTool,
  [DefaultToolName.MemoryGet]: memoryGetTool,
  [DefaultToolName.MemoryDelete]: memoryDeleteTool,
  [DefaultToolName.MemoryList]: memoryListTool,
  // Azure DevOps Work Item tools
  [DefaultToolName.AzureDevOpsGetWorkItem]: azureDevOpsGetWorkItemTool,
  [DefaultToolName.AzureDevOpsUpdateWorkItem]: azureDevOpsUpdateWorkItemTool,
  [DefaultToolName.AzureDevOpsCreateWorkItem]: azureDevOpsCreateWorkItemTool,
  [DefaultToolName.AzureDevOpsQueryWorkItems]: azureDevOpsQueryWorkItemsTool,
  [DefaultToolName.AzureDevOpsListWorkItemQueries]: azureDevOpsListWorkItemQueriesTool,
  [DefaultToolName.AzureDevOpsCreateWorkItemQuery]: azureDevOpsCreateWorkItemQueryTool,
  [DefaultToolName.AzureDevOpsRunSavedQuery]: azureDevOpsRunSavedQueryTool,
  // Azure DevOps Repository tools
  [DefaultToolName.AzureDevOpsCreateBranch]: azureDevOpsCreateBranchTool,
  [DefaultToolName.AzureDevOpsCommitChanges]: azureDevOpsCommitChangesTool,
  [DefaultToolName.AzureDevOpsCreatePR]: azureDevOpsCreatePRTool,
  [DefaultToolName.AzureDevOpsListFiles]: azureDevOpsListFilesTool,
  [DefaultToolName.AzureDevOpsReadFile]: azureDevOpsReadFileTool,
};

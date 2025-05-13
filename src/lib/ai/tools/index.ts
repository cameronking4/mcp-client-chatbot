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
};

export interface ScrapedData {
  title: string;
  imageUrl: string;
  imageDate: string;
  summary: string;
  altSummary: string;
  nodeUrl: string;
  description: string;
}

export interface ScheduledNode {
  id: number;
  description: string;
}

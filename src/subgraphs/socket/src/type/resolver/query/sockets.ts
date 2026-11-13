import { ISocketNode } from '../../model/socket';

export interface ISocketEdge {
  cursor: string;
  node: ISocketNode;
}

export interface IPageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string | null;
  endCursor?: string | null;
}

export interface ISocketConnection {
  totalCount: number;
  edges: ISocketEdge[];
  pageInfo: IPageInfo;
}

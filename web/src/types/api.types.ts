export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SearchParams {
  query?: string;
  category?: string;
  tags?: string[];
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface WebSocketEvent {
  type: string;
  data: any;
  timestamp: string;
}

export interface ContainerEvent extends WebSocketEvent {
  type: 'container:status' | 'container:created' | 'container:started' | 'container:stopped' | 'container:removed' | 'container:logs';
  data: {
    containerId: string;
    status?: string;
    previousStatus?: string;
    logs?: string;
    stream?: 'stdout' | 'stderr';
  };
}

export interface MetricsEvent extends WebSocketEvent {
  type: 'metrics:container' | 'metrics:system';
  data: {
    containerId?: string;
    metrics: any;
  };
}
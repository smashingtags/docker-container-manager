// Container types
export * from './container.types';

// App store types
export * from './app.types';

// API types
export * from './api.types';

// Plugin types
export interface PluginContext {
  logger: any;
  config: any;
  services: {
    docker: any;
    database: any;
    websocket: any;
  };
}

export interface UIComponent {
  name: string;
  component: any;
  route?: string;
}

export interface Plugin {
  name: string;
  version: string;
  initialize(context: PluginContext): Promise<void>;
  routes?: any;
  uiComponents?: UIComponent[];
}

// Service interfaces
export interface ServiceInterface {
  initialize(): Promise<void>;
  destroy(): Promise<void>;
}
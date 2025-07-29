import { ContainerConfig } from './container.types';

export interface JSONSchema {
  type: string;
  properties: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface AppTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  version: string;
  image: string;
  defaultConfig: Partial<ContainerConfig>;
  configSchema: JSONSchema;
  documentation: string;
  tags: string[];
  author?: string;
  homepage?: string;
  repository?: string;
}

export interface App {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  version: string;
  tags: string[];
  author?: string;
}

export interface AppDetails extends App {
  image: string;
  documentation: string;
  homepage?: string;
  repository?: string;
  configSchema: JSONSchema;
  defaultConfig: Partial<ContainerConfig>;
}

export interface DeployConfig {
  name: string;
  environment: Record<string, string>;
  ports: Array<{
    hostPort: number;
    containerPort: number;
    protocol: 'tcp' | 'udp';
  }>;
  volumes: Array<{
    hostPath: string;
    containerPath: string;
    mode: 'ro' | 'rw';
  }>;
  networks: string[];
  resources: {
    memory?: number;
    cpus?: number;
  };
}

export interface AppCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  appCount: number;
}
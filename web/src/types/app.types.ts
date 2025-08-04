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
  tags?: string[];
  author?: string;
  homepage?: string;
}

export interface AppCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  appCount: number;
}

export interface DeployConfig {
  name: string;
  environment?: Record<string, string>;
  ports?: PortMapping[];
  volumes?: VolumeMapping[];
  networks?: NetworkConfig[];
  resources?: ResourceLimits;
}

export interface JSONSchema {
  type: string;
  properties: Record<string, any>;
  required?: string[];
}

// Import container types for use in this file
import type { ContainerConfig, PortMapping, VolumeMapping, NetworkConfig, ResourceLimits } from './container.types';

// Re-export container types for convenience
export type { ContainerConfig, PortMapping, VolumeMapping, NetworkConfig, ResourceLimits } from './container.types';
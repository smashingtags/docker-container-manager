export interface PortMapping {
  hostPort: number;
  containerPort: number;
  protocol: 'tcp' | 'udp';
  description?: string;
}

export interface VolumeMapping {
  hostPath: string;
  containerPath: string;
  mode: 'ro' | 'rw';
  description?: string;
}

export interface NetworkConfig {
  name: string;
  driver?: string;
  options?: Record<string, string>;
}

export interface ResourceLimits {
  memory?: number; // in MB
  cpus?: number;
  diskSpace?: number; // in MB
  pidsLimit?: number;
  ulimits?: Array<{
    name: string;
    soft: number;
    hard: number;
  }>;
}

export type RestartPolicy = 'no' | 'always' | 'unless-stopped' | 'on-failure';

export interface HealthCheck {
  test: string[];
  interval?: number; // in seconds
  timeout?: number; // in seconds
  retries?: number;
  startPeriod?: number; // in seconds
}

export interface SecurityOptions {
  privileged?: boolean;
  readOnly?: boolean;
  user?: string;
  capabilities?: {
    add?: string[];
    drop?: string[];
  };
}

export interface ContainerConfig {
  id: string;
  name: string;
  image: string;
  tag: string;
  environment: Record<string, string>;
  ports: PortMapping[];
  volumes: VolumeMapping[];
  networks: string[];
  restartPolicy: RestartPolicy;
  resources: ResourceLimits;
  healthCheck?: HealthCheck;
  security?: SecurityOptions;
  labels?: Record<string, string>;
  workingDir?: string;
  entrypoint?: string[];
  command?: string[];
  hostname?: string;
  domainname?: string;
  autoRemove?: boolean;
}

export type ContainerStatus = 'running' | 'stopped' | 'paused' | 'restarting' | 'created' | 'exited';

export interface MemoryStats {
  usage: number;
  limit: number;
  percentage: number;
}

export interface NetworkStats {
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
}

export interface DiskStats {
  readBytes: number;
  writeBytes: number;
  readOps: number;
  writeOps: number;
}

export interface ContainerStats {
  cpu: number;
  memory: MemoryStats;
  network: NetworkStats;
  disk: DiskStats;
  timestamp: Date;
}

export interface Container {
  id: string;
  name: string;
  status: ContainerStatus;
  image: string;
  created: Date;
  ports: PortMapping[];
  volumes: VolumeMapping[];
  stats?: ContainerStats;
}

export interface LogOptions {
  tail?: number;
  since?: Date;
  until?: Date;
  follow?: boolean;
  timestamps?: boolean;
}

// Validation types
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult<T> {
  isValid: boolean;
  data?: T;
  errors: ValidationError[];
}

// Container creation and deployment types
export interface CreateContainerRequest {
  name: string;
  image: string;
  tag?: string;
  environment?: Record<string, string>;
  ports?: PortMapping[];
  volumes?: VolumeMapping[];
  networks?: string[];
  restartPolicy?: RestartPolicy;
  resources?: ResourceLimits;
  healthCheck?: HealthCheck;
  security?: SecurityOptions;
  labels?: Record<string, string>;
  workingDir?: string;
  entrypoint?: string[];
  command?: string[];
  hostname?: string;
  domainname?: string;
  autoRemove?: boolean;
}

export interface ContainerAction {
  type: 'start' | 'stop' | 'restart' | 'pause' | 'unpause' | 'remove';
  containerId: string;
  force?: boolean;
}
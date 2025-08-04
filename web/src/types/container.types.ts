export interface Container {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'paused' | 'restarting';
  image: string;
  created: Date;
  ports: PortMapping[];
  volumes: VolumeMapping[];
  stats?: ContainerStats;
}

export interface ContainerConfig {
  id: string;
  name: string;
  image: string;
  tag: string;
  environment: Record<string, string>;
  ports: PortMapping[];
  volumes: VolumeMapping[];
  networks: NetworkConfig[];
  restartPolicy: RestartPolicy;
  resources: ResourceLimits;
  healthCheck?: HealthCheck;
  security?: SecurityOptions;
}

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

export interface RestartPolicy {
  name: 'no' | 'always' | 'unless-stopped' | 'on-failure';
  maximumRetryCount?: number;
}

export interface ResourceLimits {
  memory?: number;
  cpus?: number;
  memorySwap?: number;
  cpuShares?: number;
}

export interface HealthCheck {
  test: string[];
  interval?: number;
  timeout?: number;
  retries?: number;
  startPeriod?: number;
}

export interface SecurityOptions {
  privileged?: boolean;
  readonlyRootfs?: boolean;
  user?: string;
  capabilities?: {
    add?: string[];
    drop?: string[];
  };
}

export interface ContainerStats {
  cpu: number;
  memory: MemoryStats;
  network: NetworkStats;
  disk: DiskStats;
}

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
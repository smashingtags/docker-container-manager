import Joi from 'joi';
import { ValidationResult, ValidationError } from '@/types/container.types';

// Common validation schemas
export const portMappingSchema = Joi.object({
  hostPort: Joi.number().integer().min(1).max(65535).required(),
  containerPort: Joi.number().integer().min(1).max(65535).required(),
  protocol: Joi.string().valid('tcp', 'udp').default('tcp'),
  description: Joi.string().optional()
});

export const volumeMappingSchema = Joi.object({
  hostPath: Joi.string().required(),
  containerPath: Joi.string().required(),
  mode: Joi.string().valid('ro', 'rw').default('rw'),
  description: Joi.string().optional()
});

export const ulimitSchema = Joi.object({
  name: Joi.string().required(),
  soft: Joi.number().integer().min(0).required(),
  hard: Joi.number().integer().min(0).required()
});

export const resourceLimitsSchema = Joi.object({
  memory: Joi.number().integer().min(1).optional(),
  cpus: Joi.number().min(0.1).optional(),
  diskSpace: Joi.number().integer().min(1).optional(),
  pidsLimit: Joi.number().integer().min(1).optional(),
  ulimits: Joi.array().items(ulimitSchema).optional()
});

export const healthCheckSchema = Joi.object({
  test: Joi.array().items(Joi.string()).min(1).required(),
  interval: Joi.number().integer().min(1).optional(),
  timeout: Joi.number().integer().min(1).optional(),
  retries: Joi.number().integer().min(0).optional(),
  startPeriod: Joi.number().integer().min(0).optional()
});

export const securityOptionsSchema = Joi.object({
  privileged: Joi.boolean().optional(),
  readOnly: Joi.boolean().optional(),
  user: Joi.string().optional(),
  capabilities: Joi.object({
    add: Joi.array().items(Joi.string()).optional(),
    drop: Joi.array().items(Joi.string()).optional()
  }).optional()
});

export const containerConfigSchema = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().pattern(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/).required(),
  image: Joi.string().required(),
  tag: Joi.string().default('latest'),
  environment: Joi.object().pattern(Joi.string(), Joi.string()).default({}),
  ports: Joi.array().items(portMappingSchema).default([]),
  volumes: Joi.array().items(volumeMappingSchema).default([]),
  networks: Joi.array().items(Joi.string()).default([]),
  restartPolicy: Joi.string().valid('no', 'always', 'unless-stopped', 'on-failure').default('unless-stopped'),
  resources: resourceLimitsSchema.default({}),
  healthCheck: healthCheckSchema.optional(),
  security: securityOptionsSchema.optional(),
  labels: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
  workingDir: Joi.string().optional(),
  entrypoint: Joi.array().items(Joi.string()).optional(),
  command: Joi.array().items(Joi.string()).optional(),
  hostname: Joi.string().optional(),
  domainname: Joi.string().optional(),
  autoRemove: Joi.boolean().optional()
});

export const createContainerRequestSchema = Joi.object({
  name: Joi.string().pattern(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/).required(),
  image: Joi.string().required(),
  tag: Joi.string().default('latest'),
  environment: Joi.object().pattern(Joi.string(), Joi.string()).default({}),
  ports: Joi.array().items(portMappingSchema).default([]),
  volumes: Joi.array().items(volumeMappingSchema).default([]),
  networks: Joi.array().items(Joi.string()).default([]),
  restartPolicy: Joi.string().valid('no', 'always', 'unless-stopped', 'on-failure').default('unless-stopped'),
  resources: resourceLimitsSchema.default({}),
  healthCheck: healthCheckSchema.optional(),
  security: securityOptionsSchema.optional(),
  labels: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
  workingDir: Joi.string().optional(),
  entrypoint: Joi.array().items(Joi.string()).optional(),
  command: Joi.array().items(Joi.string()).optional(),
  hostname: Joi.string().optional(),
  domainname: Joi.string().optional(),
  autoRemove: Joi.boolean().optional()
});

export const deployConfigSchema = Joi.object({
  name: Joi.string().pattern(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/).required(),
  environment: Joi.object().pattern(Joi.string(), Joi.string()).default({}),
  ports: Joi.array().items(portMappingSchema).default([]),
  volumes: Joi.array().items(volumeMappingSchema).default([]),
  networks: Joi.array().items(Joi.string()).default([]),
  resources: Joi.object({
    memory: Joi.number().integer().min(1).optional(),
    cpus: Joi.number().min(0.1).optional()
  }).default({})
});

export function validateSchema<T>(schema: Joi.Schema, data: any): { value: T; error?: string } {
  const { error, value } = schema.validate(data, { abortEarly: false });
  
  if (error) {
    const errorMessage = error.details.map(detail => detail.message).join(', ');
    return { value: data, error: errorMessage };
  }
  
  return { value };
}

export function validateContainerConfig<T>(schema: Joi.Schema, data: any): ValidationResult<T> {
  const { error, value } = schema.validate(data, { abortEarly: false });
  
  if (error) {
    const errors: ValidationError[] = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    }));
    
    return {
      isValid: false,
      errors
    };
  }
  
  return {
    isValid: true,
    data: value,
    errors: []
  };
}

// Specific validation functions for container configurations
export function validatePortMappings(ports: any[]): ValidationResult<any[]> {
  const result = validateContainerConfig<any[]>(Joi.array().items(portMappingSchema), ports);
  
  if (!result.isValid) {
    return result;
  }
  
  // Check for port conflicts and validate port ranges
  const hostPorts = new Set<number>();
  const conflicts: ValidationError[] = [];
  
  if (result.data) {
    result.data.forEach((port: any, index: number) => {
      // Check for duplicate host ports
      if (hostPorts.has(port.hostPort)) {
        conflicts.push({
          field: `ports[${index}].hostPort`,
          message: `Host port ${port.hostPort} is already in use`,
          value: port.hostPort
        });
      }
      hostPorts.add(port.hostPort);

      // Validate port ranges
      if (port.hostPort < 1 || port.hostPort > 65535) {
        conflicts.push({
          field: `ports[${index}].hostPort`,
          message: `Host port ${port.hostPort} must be between 1 and 65535`,
          value: port.hostPort
        });
      }

      if (port.containerPort < 1 || port.containerPort > 65535) {
        conflicts.push({
          field: `ports[${index}].containerPort`,
          message: `Container port ${port.containerPort} must be between 1 and 65535`,
          value: port.containerPort
        });
      }

      // Check for commonly reserved ports on host
      const reservedPorts = [22, 80, 443, 3306, 5432, 6379, 27017];
      if (reservedPorts.includes(port.hostPort)) {
        conflicts.push({
          field: `ports[${index}].hostPort`,
          message: `Host port ${port.hostPort} is commonly reserved and may cause conflicts`,
          value: port.hostPort
        });
      }
    });
  }
  
  if (conflicts.length > 0) {
    return {
      isValid: false,
      errors: [...result.errors, ...conflicts]
    };
  }
  
  return result;
}

export function validateVolumeMappings(volumes: any[]): ValidationResult<any[]> {
  const result = validateContainerConfig<any[]>(Joi.array().items(volumeMappingSchema), volumes);
  
  if (!result.isValid) {
    return result;
  }
  
  // Check for volume path conflicts and validate paths
  const containerPaths = new Set<string>();
  const hostPaths = new Set<string>();
  const conflicts: ValidationError[] = [];
  
  if (result.data) {
    result.data.forEach((volume: any, index: number) => {
      // Check for duplicate container paths
      if (containerPaths.has(volume.containerPath)) {
        conflicts.push({
          field: `volumes[${index}].containerPath`,
          message: `Container path ${volume.containerPath} is already mapped`,
          value: volume.containerPath
        });
      }
      containerPaths.add(volume.containerPath);

      // Check for duplicate host paths (warn but don't fail)
      if (hostPaths.has(volume.hostPath)) {
        conflicts.push({
          field: `volumes[${index}].hostPath`,
          message: `Host path ${volume.hostPath} is mapped multiple times - this may cause conflicts`,
          value: volume.hostPath
        });
      }
      hostPaths.add(volume.hostPath);

      // Validate host path format
      if (!volume.hostPath.startsWith('/') && !volume.hostPath.match(/^[A-Za-z]:\\/)) {
        conflicts.push({
          field: `volumes[${index}].hostPath`,
          message: `Host path ${volume.hostPath} must be an absolute path`,
          value: volume.hostPath
        });
      }

      // Validate container path format
      if (!volume.containerPath.startsWith('/')) {
        conflicts.push({
          field: `volumes[${index}].containerPath`,
          message: `Container path ${volume.containerPath} must be an absolute path`,
          value: volume.containerPath
        });
      }

      // Check for potentially dangerous host paths
      const dangerousPaths = ['/', '/etc', '/usr', '/var', '/boot', '/sys', '/proc'];
      if (dangerousPaths.includes(volume.hostPath) || 
          dangerousPaths.some(path => volume.hostPath.startsWith(path + '/'))) {
        conflicts.push({
          field: `volumes[${index}].hostPath`,
          message: `Host path ${volume.hostPath} may be dangerous to mount - consider using a subdirectory`,
          value: volume.hostPath
        });
      }
    });
  }
  
  if (conflicts.length > 0) {
    return {
      isValid: false,
      errors: [...result.errors, ...conflicts]
    };
  }
  
  return result;
}

export function validateNetworkConfiguration(networks: string[]): ValidationResult<string[]> {
  if (!Array.isArray(networks)) {
    return {
      isValid: false,
      errors: [{
        field: 'networks',
        message: 'Networks must be an array',
        value: networks
      }]
    };
  }
  
  const uniqueNetworks = new Set(networks);
  if (uniqueNetworks.size !== networks.length) {
    return {
      isValid: false,
      errors: [{
        field: 'networks',
        message: 'Duplicate network names are not allowed',
        value: networks
      }]
    };
  }

  // Validate network names
  const errors: ValidationError[] = [];
  networks.forEach((network, index) => {
    if (!network || typeof network !== 'string') {
      errors.push({
        field: `networks[${index}]`,
        message: 'Network name must be a non-empty string',
        value: network
      });
      return;
    }

    // Docker network name validation
    const networkNameRegex = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
    if (!networkNameRegex.test(network)) {
      errors.push({
        field: `networks[${index}]`,
        message: `Network name '${network}' contains invalid characters. Use only alphanumeric characters, dots, hyphens, and underscores`,
        value: network
      });
    }

    // Check for reserved network names (but allow Docker built-in networks)
    const reservedNetworks = ['container']; // Remove 'none' and 'host' as they are valid Docker networks
    if (reservedNetworks.includes(network)) {
      errors.push({
        field: `networks[${index}]`,
        message: `Network name '${network}' is reserved`,
        value: network
      });
    }
  });

  if (errors.length > 0) {
    return {
      isValid: false,
      errors
    };
  }
  
  return {
    isValid: true,
    data: networks,
    errors: []
  };
}

export function validateResourceLimits(resources: any): ValidationResult<any> {
  const result = validateContainerConfig<any>(resourceLimitsSchema, resources);
  
  if (!result.isValid) {
    return result;
  }
  
  // Additional validation for resource limits
  const errors: ValidationError[] = [];
  
  if (result.data && result.data.ulimits) {
    result.data.ulimits.forEach((ulimit: any, index: number) => {
      if (ulimit.hard < ulimit.soft) {
        errors.push({
          field: `resources.ulimits[${index}]`,
          message: 'Hard limit must be greater than or equal to soft limit',
          value: ulimit
        });
      }
    });
  }
  
  if (errors.length > 0) {
    return {
      isValid: false,
      errors: [...result.errors, ...errors]
    };
  }
  
  return result;
}

/**
 * Validates port mapping configuration with conflict detection
 */
export function validatePortConfiguration(
  ports: any[], 
  existingPorts?: number[]
): ValidationResult<any[]> {
  const result = validatePortMappings(ports);
  
  if (!result.isValid) {
    return result;
  }

  // Check against existing system ports if provided
  if (existingPorts && result.data) {
    const conflicts: ValidationError[] = [];
    
    result.data.forEach((port: any, index: number) => {
      if (existingPorts.includes(port.hostPort)) {
        conflicts.push({
          field: `ports[${index}].hostPort`,
          message: `Host port ${port.hostPort} is already in use by another container or service`,
          value: port.hostPort
        });
      }
    });

    if (conflicts.length > 0) {
      return {
        isValid: false,
        errors: [...result.errors, ...conflicts]
      };
    }
  }

  return result;
}

/**
 * Validates volume mounting configuration with path accessibility checks
 */
export function validateVolumeConfiguration(
  volumes: any[],
  checkHostPaths = false
): ValidationResult<any[]> {
  const result = validateVolumeMappings(volumes);
  
  if (!result.isValid) {
    return result;
  }

  if (checkHostPaths && result.data) {
    const errors: ValidationError[] = [];
    
    result.data.forEach((volume: any, index: number) => {
      // Additional host path validation would go here
      // For now, we'll do basic format validation
      
      // Check for relative paths in host path
      if (volume.hostPath.includes('../') || volume.hostPath.includes('./')) {
        errors.push({
          field: `volumes[${index}].hostPath`,
          message: `Host path ${volume.hostPath} should not contain relative path components`,
          value: volume.hostPath
        });
      }

      // Check for empty paths
      if (!volume.hostPath.trim() || !volume.containerPath.trim()) {
        errors.push({
          field: `volumes[${index}]`,
          message: 'Host path and container path cannot be empty',
          value: volume
        });
      }
    });

    if (errors.length > 0) {
      return {
        isValid: false,
        errors: [...result.errors, ...errors]
      };
    }
  }

  return result;
}

/**
 * Validates network configuration with Docker network compatibility
 */
export function validateNetworkCompatibility(
  networks: string[],
  availableNetworks?: string[]
): ValidationResult<string[]> {
  const result = validateNetworkConfiguration(networks);
  
  if (!result.isValid) {
    return result;
  }

  // Check against available networks if provided
  if (availableNetworks && result.data) {
    const errors: ValidationError[] = [];
    
    result.data.forEach((network, index) => {
      if (!availableNetworks.includes(network) && 
          !['bridge', 'host', 'none'].includes(network)) {
        errors.push({
          field: `networks[${index}]`,
          message: `Network '${network}' does not exist. Available networks: ${availableNetworks.join(', ')}`,
          value: network
        });
      }
    });

    if (errors.length > 0) {
      return {
        isValid: false,
        errors: [...result.errors, ...errors]
      };
    }
  }

  return result;
}
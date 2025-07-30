import { 
  ContainerConfig, 
  CreateContainerRequest, 
  PortMapping, 
  VolumeMapping, 
  NetworkConfig, 
  ResourceLimits, 
  HealthCheck, 
  SecurityOptions,
  ValidationError,
  ValidationResult,
  RestartPolicy
} from '../../types/container.types';

/**
 * Validates a port mapping configuration
 */
export function validatePortMapping(port: PortMapping): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate host port
  if (!Number.isInteger(port.hostPort) || port.hostPort < 1 || port.hostPort > 65535) {
    errors.push({
      field: 'hostPort',
      message: 'Host port must be an integer between 1 and 65535',
      value: port.hostPort
    });
  }

  // Validate container port
  if (!Number.isInteger(port.containerPort) || port.containerPort < 1 || port.containerPort > 65535) {
    errors.push({
      field: 'containerPort',
      message: 'Container port must be an integer between 1 and 65535',
      value: port.containerPort
    });
  }

  // Validate protocol
  if (!['tcp', 'udp'].includes(port.protocol)) {
    errors.push({
      field: 'protocol',
      message: 'Protocol must be either "tcp" or "udp"',
      value: port.protocol
    });
  }

  // Validate description if provided
  if (port.description !== undefined && typeof port.description !== 'string') {
    errors.push({
      field: 'description',
      message: 'Description must be a string',
      value: port.description
    });
  }

  return errors;
}

/**
 * Validates a volume mapping configuration
 */
export function validateVolumeMapping(volume: VolumeMapping): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate host path
  if (!volume.hostPath || typeof volume.hostPath !== 'string') {
    errors.push({
      field: 'hostPath',
      message: 'Host path is required and must be a string',
      value: volume.hostPath
    });
  } else if (!volume.hostPath.startsWith('/')) {
    errors.push({
      field: 'hostPath',
      message: 'Host path must be an absolute path starting with "/"',
      value: volume.hostPath
    });
  }

  // Validate container path
  if (!volume.containerPath || typeof volume.containerPath !== 'string') {
    errors.push({
      field: 'containerPath',
      message: 'Container path is required and must be a string',
      value: volume.containerPath
    });
  } else if (!volume.containerPath.startsWith('/')) {
    errors.push({
      field: 'containerPath',
      message: 'Container path must be an absolute path starting with "/"',
      value: volume.containerPath
    });
  }

  // Validate mode
  if (!['ro', 'rw'].includes(volume.mode)) {
    errors.push({
      field: 'mode',
      message: 'Mode must be either "ro" (read-only) or "rw" (read-write)',
      value: volume.mode
    });
  }

  // Validate description if provided
  if (volume.description !== undefined && typeof volume.description !== 'string') {
    errors.push({
      field: 'description',
      message: 'Description must be a string',
      value: volume.description
    });
  }

  return errors;
}

/**
 * Validates network configuration
 */
export function validateNetworkConfig(network: NetworkConfig): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate network name
  if (!network.name || typeof network.name !== 'string') {
    errors.push({
      field: 'name',
      message: 'Network name is required and must be a string',
      value: network.name
    });
  } else if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(network.name)) {
    errors.push({
      field: 'name',
      message: 'Network name must start with alphanumeric character and contain only letters, numbers, underscores, dots, and hyphens',
      value: network.name
    });
  }

  // Validate driver if provided
  if (network.driver !== undefined && typeof network.driver !== 'string') {
    errors.push({
      field: 'driver',
      message: 'Network driver must be a string',
      value: network.driver
    });
  }

  // Validate options if provided
  if (network.options !== undefined) {
    if (typeof network.options !== 'object' || network.options === null) {
      errors.push({
        field: 'options',
        message: 'Network options must be an object',
        value: network.options
      });
    } else {
      Object.entries(network.options).forEach(([key, value]) => {
        if (typeof value !== 'string') {
          errors.push({
            field: `options.${key}`,
            message: 'Network option values must be strings',
            value: value
          });
        }
      });
    }
  }

  return errors;
}/**
 
* Validates resource limits configuration
 */
export function validateResourceLimits(resources: ResourceLimits): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate memory if provided
  if (resources.memory !== undefined) {
    if (!Number.isInteger(resources.memory) || resources.memory <= 0) {
      errors.push({
        field: 'memory',
        message: 'Memory limit must be a positive integer (in MB)',
        value: resources.memory
      });
    } else if (resources.memory < 4) {
      errors.push({
        field: 'memory',
        message: 'Memory limit must be at least 4 MB',
        value: resources.memory
      });
    }
  }

  // Validate CPUs if provided
  if (resources.cpus !== undefined) {
    if (typeof resources.cpus !== 'number' || resources.cpus <= 0) {
      errors.push({
        field: 'cpus',
        message: 'CPU limit must be a positive number',
        value: resources.cpus
      });
    } else if (resources.cpus > 64) {
      errors.push({
        field: 'cpus',
        message: 'CPU limit cannot exceed 64 cores',
        value: resources.cpus
      });
    }
  }

  // Validate disk space if provided
  if (resources.diskSpace !== undefined) {
    if (!Number.isInteger(resources.diskSpace) || resources.diskSpace <= 0) {
      errors.push({
        field: 'diskSpace',
        message: 'Disk space limit must be a positive integer (in MB)',
        value: resources.diskSpace
      });
    }
  }

  // Validate PIDs limit if provided
  if (resources.pidsLimit !== undefined) {
    if (!Number.isInteger(resources.pidsLimit) || resources.pidsLimit <= 0) {
      errors.push({
        field: 'pidsLimit',
        message: 'PIDs limit must be a positive integer',
        value: resources.pidsLimit
      });
    }
  }

  // Validate ulimits if provided
  if (resources.ulimits !== undefined) {
    if (!Array.isArray(resources.ulimits)) {
      errors.push({
        field: 'ulimits',
        message: 'Ulimits must be an array',
        value: resources.ulimits
      });
    } else {
      resources.ulimits.forEach((ulimit, index) => {
        if (!ulimit.name || typeof ulimit.name !== 'string') {
          errors.push({
            field: `ulimits[${index}].name`,
            message: 'Ulimit name is required and must be a string',
            value: ulimit.name
          });
        }

        if (!Number.isInteger(ulimit.soft) || ulimit.soft < 0) {
          errors.push({
            field: `ulimits[${index}].soft`,
            message: 'Ulimit soft value must be a non-negative integer',
            value: ulimit.soft
          });
        }

        if (!Number.isInteger(ulimit.hard) || ulimit.hard < 0) {
          errors.push({
            field: `ulimits[${index}].hard`,
            message: 'Ulimit hard value must be a non-negative integer',
            value: ulimit.hard
          });
        }

        if (ulimit.soft > ulimit.hard) {
          errors.push({
            field: `ulimits[${index}]`,
            message: 'Ulimit soft value cannot be greater than hard value',
            value: { soft: ulimit.soft, hard: ulimit.hard }
          });
        }
      });
    }
  }

  return errors;
}

/**
 * Validates health check configuration
 */
export function validateHealthCheck(healthCheck: HealthCheck): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate test command
  if (!Array.isArray(healthCheck.test) || healthCheck.test.length === 0) {
    errors.push({
      field: 'test',
      message: 'Health check test must be a non-empty array of strings',
      value: healthCheck.test
    });
  } else {
    healthCheck.test.forEach((cmd, index) => {
      if (typeof cmd !== 'string') {
        errors.push({
          field: `test[${index}]`,
          message: 'Health check test commands must be strings',
          value: cmd
        });
      }
    });
  }

  // Validate interval if provided
  if (healthCheck.interval !== undefined) {
    if (!Number.isInteger(healthCheck.interval) || healthCheck.interval <= 0) {
      errors.push({
        field: 'interval',
        message: 'Health check interval must be a positive integer (in seconds)',
        value: healthCheck.interval
      });
    }
  }

  // Validate timeout if provided
  if (healthCheck.timeout !== undefined) {
    if (!Number.isInteger(healthCheck.timeout) || healthCheck.timeout <= 0) {
      errors.push({
        field: 'timeout',
        message: 'Health check timeout must be a positive integer (in seconds)',
        value: healthCheck.timeout
      });
    }
  }

  // Validate retries if provided
  if (healthCheck.retries !== undefined) {
    if (!Number.isInteger(healthCheck.retries) || healthCheck.retries < 0) {
      errors.push({
        field: 'retries',
        message: 'Health check retries must be a non-negative integer',
        value: healthCheck.retries
      });
    }
  }

  // Validate start period if provided
  if (healthCheck.startPeriod !== undefined) {
    if (!Number.isInteger(healthCheck.startPeriod) || healthCheck.startPeriod < 0) {
      errors.push({
        field: 'startPeriod',
        message: 'Health check start period must be a non-negative integer (in seconds)',
        value: healthCheck.startPeriod
      });
    }
  }

  // Validate logical constraints
  if (healthCheck.timeout !== undefined && healthCheck.interval !== undefined) {
    if (healthCheck.timeout >= healthCheck.interval) {
      errors.push({
        field: 'timeout',
        message: 'Health check timeout must be less than interval',
        value: { timeout: healthCheck.timeout, interval: healthCheck.interval }
      });
    }
  }

  return errors;
}

/**
 * Validates security options configuration
 */
export function validateSecurityOptions(security: SecurityOptions): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate privileged if provided
  if (security.privileged !== undefined && typeof security.privileged !== 'boolean') {
    errors.push({
      field: 'privileged',
      message: 'Privileged must be a boolean',
      value: security.privileged
    });
  }

  // Validate readOnly if provided
  if (security.readOnly !== undefined && typeof security.readOnly !== 'boolean') {
    errors.push({
      field: 'readOnly',
      message: 'ReadOnly must be a boolean',
      value: security.readOnly
    });
  }

  // Validate user if provided
  if (security.user !== undefined) {
    if (typeof security.user !== 'string') {
      errors.push({
        field: 'user',
        message: 'User must be a string',
        value: security.user
      });
    } else if (!/^[a-zA-Z0-9_-]+(:?[a-zA-Z0-9_-]+)?$/.test(security.user)) {
      errors.push({
        field: 'user',
        message: 'User must be in format "user" or "user:group" with alphanumeric characters, underscores, and hyphens',
        value: security.user
      });
    }
  }

  // Validate capabilities if provided
  if (security.capabilities !== undefined) {
    if (typeof security.capabilities !== 'object' || security.capabilities === null) {
      errors.push({
        field: 'capabilities',
        message: 'Capabilities must be an object',
        value: security.capabilities
      });
    } else {
      // Validate add capabilities
      if (security.capabilities.add !== undefined) {
        if (!Array.isArray(security.capabilities.add)) {
          errors.push({
            field: 'capabilities.add',
            message: 'Capabilities add must be an array',
            value: security.capabilities.add
          });
        } else {
          security.capabilities.add.forEach((cap, index) => {
            if (typeof cap !== 'string') {
              errors.push({
                field: `capabilities.add[${index}]`,
                message: 'Capability must be a string',
                value: cap
              });
            }
          });
        }
      }

      // Validate drop capabilities
      if (security.capabilities.drop !== undefined) {
        if (!Array.isArray(security.capabilities.drop)) {
          errors.push({
            field: 'capabilities.drop',
            message: 'Capabilities drop must be an array',
            value: security.capabilities.drop
          });
        } else {
          security.capabilities.drop.forEach((cap, index) => {
            if (typeof cap !== 'string') {
              errors.push({
                field: `capabilities.drop[${index}]`,
                message: 'Capability must be a string',
                value: cap
              });
            }
          });
        }
      }
    }
  }

  return errors;
}/**
 * Val
idates restart policy
 */
export function validateRestartPolicy(policy: RestartPolicy): ValidationError[] {
  const errors: ValidationError[] = [];
  const validPolicies: RestartPolicy[] = ['no', 'always', 'unless-stopped', 'on-failure'];

  if (!validPolicies.includes(policy)) {
    errors.push({
      field: 'restartPolicy',
      message: `Restart policy must be one of: ${validPolicies.join(', ')}`,
      value: policy
    });
  }

  return errors;
}

/**
 * Validates container name
 */
export function validateContainerName(name: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!name || typeof name !== 'string') {
    errors.push({
      field: 'name',
      message: 'Container name is required and must be a string',
      value: name
    });
    return errors;
  }

  // Docker container name validation rules
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name)) {
    errors.push({
      field: 'name',
      message: 'Container name must start with alphanumeric character and contain only letters, numbers, underscores, dots, and hyphens',
      value: name
    });
  }

  if (name.length > 63) {
    errors.push({
      field: 'name',
      message: 'Container name must not exceed 63 characters',
      value: name
    });
  }

  return errors;
}

/**
 * Validates Docker image reference
 */
export function validateImageReference(image: string, tag?: string): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!image || typeof image !== 'string') {
    errors.push({
      field: 'image',
      message: 'Image name is required and must be a string',
      value: image
    });
    return errors;
  }

  // Basic image name validation
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*$/.test(image)) {
    errors.push({
      field: 'image',
      message: 'Image name must be lowercase and follow Docker naming conventions',
      value: image
    });
  }

  // Validate tag if provided
  if (tag !== undefined) {
    if (typeof tag !== 'string') {
      errors.push({
        field: 'tag',
        message: 'Image tag must be a string',
        value: tag
      });
    } else if (!/^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$/.test(tag)) {
      errors.push({
        field: 'tag',
        message: 'Image tag must start with alphanumeric or underscore and contain only letters, numbers, underscores, dots, and hyphens',
        value: tag
      });
    } else if (tag.length > 128) {
      errors.push({
        field: 'tag',
        message: 'Image tag must not exceed 128 characters',
        value: tag
      });
    }
  }

  return errors;
}

/**
 * Validates environment variables
 */
export function validateEnvironmentVariables(environment: Record<string, string>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof environment !== 'object' || environment === null) {
    errors.push({
      field: 'environment',
      message: 'Environment variables must be an object',
      value: environment
    });
    return errors;
  }

  Object.entries(environment).forEach(([key, value]) => {
    // Validate environment variable name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      errors.push({
        field: `environment.${key}`,
        message: 'Environment variable name must start with letter or underscore and contain only letters, numbers, and underscores',
        value: key
      });
    }

    // Validate environment variable value
    if (typeof value !== 'string') {
      errors.push({
        field: `environment.${key}`,
        message: 'Environment variable value must be a string',
        value: value
      });
    }
  });

  return errors;
}

/**
 * Validates a complete container configuration
 */
export function validateContainerConfig(config: ContainerConfig): ValidationResult<ContainerConfig> {
  const errors: ValidationError[] = [];

  // Validate required fields
  errors.push(...validateContainerName(config.name));
  errors.push(...validateImageReference(config.image, config.tag));
  errors.push(...validateRestartPolicy(config.restartPolicy));

  // Validate environment variables
  if (config.environment) {
    errors.push(...validateEnvironmentVariables(config.environment));
  }

  // Validate ports
  if (config.ports && Array.isArray(config.ports)) {
    config.ports.forEach((port, index) => {
      const portErrors = validatePortMapping(port);
      portErrors.forEach(error => {
        errors.push({
          ...error,
          field: `ports[${index}].${error.field}`
        });
      });
    });

    // Check for port conflicts
    const hostPorts = config.ports.map(p => p.hostPort);
    const duplicatePorts = hostPorts.filter((port, index) => hostPorts.indexOf(port) !== index);
    if (duplicatePorts.length > 0) {
      errors.push({
        field: 'ports',
        message: `Duplicate host ports found: ${[...new Set(duplicatePorts)].join(', ')}`,
        value: duplicatePorts
      });
    }
  }

  // Validate volumes
  if (config.volumes && Array.isArray(config.volumes)) {
    config.volumes.forEach((volume, index) => {
      const volumeErrors = validateVolumeMapping(volume);
      volumeErrors.forEach(error => {
        errors.push({
          ...error,
          field: `volumes[${index}].${error.field}`
        });
      });
    });
  }

  // Validate resource limits
  if (config.resources) {
    const resourceErrors = validateResourceLimits(config.resources);
    resourceErrors.forEach(error => {
      errors.push({
        ...error,
        field: `resources.${error.field}`
      });
    });
  }

  // Validate health check
  if (config.healthCheck) {
    const healthErrors = validateHealthCheck(config.healthCheck);
    healthErrors.forEach(error => {
      errors.push({
        ...error,
        field: `healthCheck.${error.field}`
      });
    });
  }

  // Validate security options
  if (config.security) {
    const securityErrors = validateSecurityOptions(config.security);
    securityErrors.forEach(error => {
      errors.push({
        ...error,
        field: `security.${error.field}`
      });
    });
  }

  // Validate networks
  if (config.networks && Array.isArray(config.networks)) {
    config.networks.forEach((network, index) => {
      if (typeof network !== 'string') {
        errors.push({
          field: `networks[${index}]`,
          message: 'Network name must be a string',
          value: network
        });
      }
    });
  }

  // Validate labels
  if (config.labels) {
    if (typeof config.labels !== 'object' || config.labels === null) {
      errors.push({
        field: 'labels',
        message: 'Labels must be an object',
        value: config.labels
      });
    } else {
      Object.entries(config.labels).forEach(([key, value]) => {
        if (typeof value !== 'string') {
          errors.push({
            field: `labels.${key}`,
            message: 'Label value must be a string',
            value: value
          });
        }
      });
    }
  }

  // Validate optional string fields
  const stringFields = ['workingDir', 'hostname', 'domainname'];
  stringFields.forEach(field => {
    const value = (config as any)[field];
    if (value !== undefined && typeof value !== 'string') {
      errors.push({
        field,
        message: `${field} must be a string`,
        value
      });
    }
  });

  // Validate optional array fields
  const arrayFields = ['entrypoint', 'command'];
  arrayFields.forEach(field => {
    const value = (config as any)[field];
    if (value !== undefined) {
      if (!Array.isArray(value)) {
        errors.push({
          field,
          message: `${field} must be an array`,
          value
        });
      } else {
        value.forEach((item, index) => {
          if (typeof item !== 'string') {
            errors.push({
              field: `${field}[${index}]`,
              message: `${field} items must be strings`,
              value: item
            });
          }
        });
      }
    }
  });

  // Validate autoRemove
  if (config.autoRemove !== undefined && typeof config.autoRemove !== 'boolean') {
    errors.push({
      field: 'autoRemove',
      message: 'autoRemove must be a boolean',
      value: config.autoRemove
    });
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? config : undefined,
    errors
  };
}

/**
 * Validates a container creation request
 */
export function validateCreateContainerRequest(request: CreateContainerRequest): ValidationResult<CreateContainerRequest> {
  const errors: ValidationError[] = [];

  // Validate required fields
  errors.push(...validateContainerName(request.name));
  errors.push(...validateImageReference(request.image, request.tag));

  // Validate optional restart policy
  if (request.restartPolicy) {
    errors.push(...validateRestartPolicy(request.restartPolicy));
  }

  // Validate environment variables if provided
  if (request.environment) {
    errors.push(...validateEnvironmentVariables(request.environment));
  }

  // Validate ports if provided
  if (request.ports && Array.isArray(request.ports)) {
    request.ports.forEach((port, index) => {
      const portErrors = validatePortMapping(port);
      portErrors.forEach(error => {
        errors.push({
          ...error,
          field: `ports[${index}].${error.field}`
        });
      });
    });

    // Check for port conflicts
    const hostPorts = request.ports.map(p => p.hostPort);
    const duplicatePorts = hostPorts.filter((port, index) => hostPorts.indexOf(port) !== index);
    if (duplicatePorts.length > 0) {
      errors.push({
        field: 'ports',
        message: `Duplicate host ports found: ${[...new Set(duplicatePorts)].join(', ')}`,
        value: duplicatePorts
      });
    }
  }

  // Validate volumes if provided
  if (request.volumes && Array.isArray(request.volumes)) {
    request.volumes.forEach((volume, index) => {
      const volumeErrors = validateVolumeMapping(volume);
      volumeErrors.forEach(error => {
        errors.push({
          ...error,
          field: `volumes[${index}].${error.field}`
        });
      });
    });
  }

  // Validate resource limits if provided
  if (request.resources) {
    const resourceErrors = validateResourceLimits(request.resources);
    resourceErrors.forEach(error => {
      errors.push({
        ...error,
        field: `resources.${error.field}`
      });
    });
  }

  // Validate health check if provided
  if (request.healthCheck) {
    const healthErrors = validateHealthCheck(request.healthCheck);
    healthErrors.forEach(error => {
      errors.push({
        ...error,
        field: `healthCheck.${error.field}`
      });
    });
  }

  // Validate security options if provided
  if (request.security) {
    const securityErrors = validateSecurityOptions(request.security);
    securityErrors.forEach(error => {
      errors.push({
        ...error,
        field: `security.${error.field}`
      });
    });
  }

  // Validate networks if provided
  if (request.networks && Array.isArray(request.networks)) {
    request.networks.forEach((network, index) => {
      if (typeof network !== 'string') {
        errors.push({
          field: `networks[${index}]`,
          message: 'Network name must be a string',
          value: network
        });
      }
    });
  }

  // Validate labels if provided
  if (request.labels) {
    if (typeof request.labels !== 'object' || request.labels === null) {
      errors.push({
        field: 'labels',
        message: 'Labels must be an object',
        value: request.labels
      });
    } else {
      Object.entries(request.labels).forEach(([key, value]) => {
        if (typeof value !== 'string') {
          errors.push({
            field: `labels.${key}`,
            message: 'Label value must be a string',
            value: value
          });
        }
      });
    }
  }

  // Validate optional string fields
  const stringFields = ['workingDir', 'hostname', 'domainname'];
  stringFields.forEach(field => {
    const value = (request as any)[field];
    if (value !== undefined && typeof value !== 'string') {
      errors.push({
        field,
        message: `${field} must be a string`,
        value
      });
    }
  });

  // Validate optional array fields
  const arrayFields = ['entrypoint', 'command'];
  arrayFields.forEach(field => {
    const value = (request as any)[field];
    if (value !== undefined) {
      if (!Array.isArray(value)) {
        errors.push({
          field,
          message: `${field} must be an array`,
          value
        });
      } else {
        value.forEach((item, index) => {
          if (typeof item !== 'string') {
            errors.push({
              field: `${field}[${index}]`,
              message: `${field} items must be strings`,
              value: item
            });
          }
        });
      }
    }
  });

  // Validate autoRemove if provided
  if (request.autoRemove !== undefined && typeof request.autoRemove !== 'boolean') {
    errors.push({
      field: 'autoRemove',
      message: 'autoRemove must be a boolean',
      value: request.autoRemove
    });
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? request : undefined,
    errors
  };
}

/**
 * Utility function to check for port conflicts across multiple containers
 */
export function validatePortConflicts(containers: ContainerConfig[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const portMap = new Map<number, string[]>();

  containers.forEach(container => {
    container.ports.forEach(port => {
      if (!portMap.has(port.hostPort)) {
        portMap.set(port.hostPort, []);
      }
      portMap.get(port.hostPort)!.push(container.name);
    });
  });

  portMap.forEach((containerNames, port) => {
    if (containerNames.length > 1) {
      errors.push({
        field: 'ports',
        message: `Port ${port} is used by multiple containers: ${containerNames.join(', ')}`,
        value: { port, containers: containerNames }
      });
    }
  });

  return errors;
}
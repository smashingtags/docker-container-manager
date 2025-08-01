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
import * as path from 'path';
import * as fs from 'fs';

/**
 * Validates a complete container configuration
 */
export function validateContainerConfig(config: ContainerConfig): ValidationResult<ContainerConfig> {
  const errors: ValidationError[] = [];

  // Validate required fields
  if (!config.id || typeof config.id !== 'string' || config.id.trim().length === 0) {
    errors.push({ field: 'id', message: 'Container ID is required and must be a non-empty string' });
  }

  if (!config.name || typeof config.name !== 'string' || config.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Container name is required and must be a non-empty string' });
  } else if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(config.name)) {
    errors.push({ 
      field: 'name', 
      message: 'Container name must start with alphanumeric character and contain only letters, numbers, underscores, periods, and hyphens',
      value: config.name 
    });
  }

  if (!config.image || typeof config.image !== 'string' || config.image.trim().length === 0) {
    errors.push({ field: 'image', message: 'Container image is required and must be a non-empty string' });
  }

  if (!config.tag || typeof config.tag !== 'string' || config.tag.trim().length === 0) {
    errors.push({ field: 'tag', message: 'Container tag is required and must be a non-empty string' });
  }

  // Validate environment variables
  if (config.environment && typeof config.environment !== 'object') {
    errors.push({ field: 'environment', message: 'Environment must be an object' });
  } else if (config.environment) {
    Object.entries(config.environment).forEach(([key, value]) => {
      if (typeof key !== 'string' || key.trim().length === 0) {
        errors.push({ field: 'environment', message: 'Environment variable keys must be non-empty strings', value: key });
      }
      if (typeof value !== 'string') {
        errors.push({ field: 'environment', message: 'Environment variable values must be strings', value: { key, value } });
      }
    });
  }

  // Validate ports
  if (config.ports && Array.isArray(config.ports)) {
    config.ports.forEach((port, index) => {
      const portValidation = validatePortMapping(port);
      if (!portValidation.isValid) {
        portValidation.errors.forEach(error => {
          errors.push({ 
            field: `ports[${index}].${error.field}`, 
            message: error.message, 
            value: error.value 
          });
        });
      }
    });
  }

  // Validate volumes
  if (config.volumes && Array.isArray(config.volumes)) {
    config.volumes.forEach((volume, index) => {
      const volumeValidation = validateVolumeMapping(volume);
      if (!volumeValidation.isValid) {
        volumeValidation.errors.forEach(error => {
          errors.push({ 
            field: `volumes[${index}].${error.field}`, 
            message: error.message, 
            value: error.value 
          });
        });
      }
    });
  }

  // Validate networks
  if (config.networks && !Array.isArray(config.networks)) {
    errors.push({ field: 'networks', message: 'Networks must be an array of strings' });
  } else if (config.networks) {
    config.networks.forEach((network, index) => {
      if (typeof network !== 'string' || network.trim().length === 0) {
        errors.push({ 
          field: `networks[${index}]`, 
          message: 'Network name must be a non-empty string', 
          value: network 
        });
      }
    });
  }

  // Validate restart policy
  const restartPolicyValidation = validateRestartPolicy(config.restartPolicy);
  if (!restartPolicyValidation.isValid) {
    errors.push(...restartPolicyValidation.errors);
  }

  // Validate resource limits
  if (config.resources) {
    const resourceValidation = validateResourceLimits(config.resources);
    if (!resourceValidation.isValid) {
      resourceValidation.errors.forEach(error => {
        errors.push({ 
          field: `resources.${error.field}`, 
          message: error.message, 
          value: error.value 
        });
      });
    }
  }

  // Validate health check
  if (config.healthCheck) {
    const healthCheckValidation = validateHealthCheck(config.healthCheck);
    if (!healthCheckValidation.isValid) {
      healthCheckValidation.errors.forEach(error => {
        errors.push({ 
          field: `healthCheck.${error.field}`, 
          message: error.message, 
          value: error.value 
        });
      });
    }
  }

  // Validate security options
  if (config.security) {
    const securityValidation = validateSecurityOptions(config.security);
    if (!securityValidation.isValid) {
      securityValidation.errors.forEach(error => {
        errors.push({ 
          field: `security.${error.field}`, 
          message: error.message, 
          value: error.value 
        });
      });
    }
  }

  // Validate optional string fields
  const stringFields = ['workingDir', 'hostname', 'domainname'];
  stringFields.forEach(field => {
    const value = (config as any)[field];
    if (value !== undefined && (typeof value !== 'string' || value.trim().length === 0)) {
      errors.push({ 
        field, 
        message: `${field} must be a non-empty string if provided`, 
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
          message: `${field} must be an array if provided`, 
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

  // Validate labels
  if (config.labels && typeof config.labels !== 'object') {
    errors.push({ field: 'labels', message: 'Labels must be an object' });
  } else if (config.labels) {
    Object.entries(config.labels).forEach(([key, value]) => {
      if (typeof key !== 'string' || key.trim().length === 0) {
        errors.push({ field: 'labels', message: 'Label keys must be non-empty strings', value: key });
      }
      if (typeof value !== 'string') {
        errors.push({ field: 'labels', message: 'Label values must be strings', value: { key, value } });
      }
    });
  }

  // Validate autoRemove
  if (config.autoRemove !== undefined && typeof config.autoRemove !== 'boolean') {
    errors.push({ 
      field: 'autoRemove', 
      message: 'autoRemove must be a boolean if provided', 
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
  if (!request.name || typeof request.name !== 'string' || request.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Container name is required and must be a non-empty string' });
  } else if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(request.name)) {
    errors.push({ 
      field: 'name', 
      message: 'Container name must start with alphanumeric character and contain only letters, numbers, underscores, periods, and hyphens',
      value: request.name 
    });
  }

  if (!request.image || typeof request.image !== 'string' || request.image.trim().length === 0) {
    errors.push({ field: 'image', message: 'Container image is required and must be a non-empty string' });
  }

  // Validate optional tag (defaults to 'latest' if not provided)
  if (request.tag !== undefined && (typeof request.tag !== 'string' || request.tag.trim().length === 0)) {
    errors.push({ field: 'tag', message: 'Container tag must be a non-empty string if provided' });
  }

  // Validate environment variables
  if (request.environment && typeof request.environment !== 'object') {
    errors.push({ field: 'environment', message: 'Environment must be an object' });
  } else if (request.environment) {
    Object.entries(request.environment).forEach(([key, value]) => {
      if (typeof key !== 'string' || key.trim().length === 0) {
        errors.push({ field: 'environment', message: 'Environment variable keys must be non-empty strings', value: key });
      }
      if (typeof value !== 'string') {
        errors.push({ field: 'environment', message: 'Environment variable values must be strings', value: { key, value } });
      }
    });
  }

  // Validate ports
  if (request.ports && Array.isArray(request.ports)) {
    request.ports.forEach((port, index) => {
      const portValidation = validatePortMapping(port);
      if (!portValidation.isValid) {
        portValidation.errors.forEach(error => {
          errors.push({ 
            field: `ports[${index}].${error.field}`, 
            message: error.message, 
            value: error.value 
          });
        });
      }
    });
  }

  // Validate volumes
  if (request.volumes && Array.isArray(request.volumes)) {
    request.volumes.forEach((volume, index) => {
      const volumeValidation = validateVolumeMapping(volume);
      if (!volumeValidation.isValid) {
        volumeValidation.errors.forEach(error => {
          errors.push({ 
            field: `volumes[${index}].${error.field}`, 
            message: error.message, 
            value: error.value 
          });
        });
      }
    });
  }

  // Validate networks
  if (request.networks && !Array.isArray(request.networks)) {
    errors.push({ field: 'networks', message: 'Networks must be an array of strings' });
  } else if (request.networks) {
    request.networks.forEach((network, index) => {
      if (typeof network !== 'string' || network.trim().length === 0) {
        errors.push({ 
          field: `networks[${index}]`, 
          message: 'Network name must be a non-empty string', 
          value: network 
        });
      }
    });
  }

  // Validate restart policy
  if (request.restartPolicy) {
    const restartPolicyValidation = validateRestartPolicy(request.restartPolicy);
    if (!restartPolicyValidation.isValid) {
      errors.push(...restartPolicyValidation.errors);
    }
  }

  // Validate resource limits
  if (request.resources) {
    const resourceValidation = validateResourceLimits(request.resources);
    if (!resourceValidation.isValid) {
      resourceValidation.errors.forEach(error => {
        errors.push({ 
          field: `resources.${error.field}`, 
          message: error.message, 
          value: error.value 
        });
      });
    }
  }

  // Validate health check
  if (request.healthCheck) {
    const healthCheckValidation = validateHealthCheck(request.healthCheck);
    if (!healthCheckValidation.isValid) {
      healthCheckValidation.errors.forEach(error => {
        errors.push({ 
          field: `healthCheck.${error.field}`, 
          message: error.message, 
          value: error.value 
        });
      });
    }
  }

  // Validate security options
  if (request.security) {
    const securityValidation = validateSecurityOptions(request.security);
    if (!securityValidation.isValid) {
      securityValidation.errors.forEach(error => {
        errors.push({ 
          field: `security.${error.field}`, 
          message: error.message, 
          value: error.value 
        });
      });
    }
  }

  // Validate optional string fields
  const stringFields = ['workingDir', 'hostname', 'domainname'];
  stringFields.forEach(field => {
    const value = (request as any)[field];
    if (value !== undefined && (typeof value !== 'string' || value.trim().length === 0)) {
      errors.push({ 
        field, 
        message: `${field} must be a non-empty string if provided`, 
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
          message: `${field} must be an array if provided`, 
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

  // Validate labels
  if (request.labels && typeof request.labels !== 'object') {
    errors.push({ field: 'labels', message: 'Labels must be an object' });
  } else if (request.labels) {
    Object.entries(request.labels).forEach(([key, value]) => {
      if (typeof key !== 'string' || key.trim().length === 0) {
        errors.push({ field: 'labels', message: 'Label keys must be non-empty strings', value: key });
      }
      if (typeof value !== 'string') {
        errors.push({ field: 'labels', message: 'Label values must be strings', value: { key, value } });
      }
    });
  }

  // Validate autoRemove
  if (request.autoRemove !== undefined && typeof request.autoRemove !== 'boolean') {
    errors.push({ 
      field: 'autoRemove', 
      message: 'autoRemove must be a boolean if provided', 
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
 * Validates port mapping configuration
 */
export function validatePortMapping(port: PortMapping): ValidationResult<PortMapping> {
  const errors: ValidationError[] = [];

  // Validate host port
  if (typeof port.hostPort !== 'number' || !Number.isInteger(port.hostPort)) {
    errors.push({ field: 'hostPort', message: 'Host port must be an integer', value: port.hostPort });
  } else if (port.hostPort < 1 || port.hostPort > 65535) {
    errors.push({ field: 'hostPort', message: 'Host port must be between 1 and 65535', value: port.hostPort });
  }

  // Validate container port
  if (typeof port.containerPort !== 'number' || !Number.isInteger(port.containerPort)) {
    errors.push({ field: 'containerPort', message: 'Container port must be an integer', value: port.containerPort });
  } else if (port.containerPort < 1 || port.containerPort > 65535) {
    errors.push({ field: 'containerPort', message: 'Container port must be between 1 and 65535', value: port.containerPort });
  }

  // Validate protocol
  if (!['tcp', 'udp'].includes(port.protocol)) {
    errors.push({ field: 'protocol', message: 'Protocol must be either "tcp" or "udp"', value: port.protocol });
  }

  // Validate optional description
  if (port.description !== undefined && (typeof port.description !== 'string' || port.description.trim().length === 0)) {
    errors.push({ field: 'description', message: 'Description must be a non-empty string if provided', value: port.description });
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? port : undefined,
    errors
  };
}

/**
 * Validates volume mapping configuration
 */
export function validateVolumeMapping(volume: VolumeMapping): ValidationResult<VolumeMapping> {
  const errors: ValidationError[] = [];

  // Validate host path
  if (!volume.hostPath || typeof volume.hostPath !== 'string' || volume.hostPath.trim().length === 0) {
    errors.push({ field: 'hostPath', message: 'Host path is required and must be a non-empty string' });
  } else if (!path.isAbsolute(volume.hostPath)) {
    errors.push({ field: 'hostPath', message: 'Host path must be an absolute path', value: volume.hostPath });
  }

  // Validate container path
  if (!volume.containerPath || typeof volume.containerPath !== 'string' || volume.containerPath.trim().length === 0) {
    errors.push({ field: 'containerPath', message: 'Container path is required and must be a non-empty string' });
  } else if (!path.isAbsolute(volume.containerPath)) {
    errors.push({ field: 'containerPath', message: 'Container path must be an absolute path', value: volume.containerPath });
  }

  // Validate mode
  if (!['ro', 'rw'].includes(volume.mode)) {
    errors.push({ field: 'mode', message: 'Mode must be either "ro" (read-only) or "rw" (read-write)', value: volume.mode });
  }

  // Validate optional description
  if (volume.description !== undefined && (typeof volume.description !== 'string' || volume.description.trim().length === 0)) {
    errors.push({ field: 'description', message: 'Description must be a non-empty string if provided', value: volume.description });
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? volume : undefined,
    errors
  };
}/**
 *
 Validates restart policy
 */
export function validateRestartPolicy(policy: RestartPolicy): ValidationResult<RestartPolicy> {
  const errors: ValidationError[] = [];
  const validPolicies: RestartPolicy[] = ['no', 'always', 'unless-stopped', 'on-failure'];

  if (!validPolicies.includes(policy)) {
    errors.push({ 
      field: 'restartPolicy', 
      message: `Restart policy must be one of: ${validPolicies.join(', ')}`, 
      value: policy 
    });
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? policy : undefined,
    errors
  };
}

/**
 * Validates resource limits configuration
 */
export function validateResourceLimits(resources: ResourceLimits): ValidationResult<ResourceLimits> {
  const errors: ValidationError[] = [];

  // Validate memory limit (in MB)
  if (resources.memory !== undefined) {
    if (typeof resources.memory !== 'number' || !Number.isInteger(resources.memory)) {
      errors.push({ field: 'memory', message: 'Memory limit must be an integer (MB)', value: resources.memory });
    } else if (resources.memory <= 0) {
      errors.push({ field: 'memory', message: 'Memory limit must be greater than 0', value: resources.memory });
    } else if (resources.memory > 1048576) { // 1TB in MB
      errors.push({ field: 'memory', message: 'Memory limit cannot exceed 1TB (1048576 MB)', value: resources.memory });
    }
  }

  // Validate CPU limit
  if (resources.cpus !== undefined) {
    if (typeof resources.cpus !== 'number') {
      errors.push({ field: 'cpus', message: 'CPU limit must be a number', value: resources.cpus });
    } else if (resources.cpus <= 0) {
      errors.push({ field: 'cpus', message: 'CPU limit must be greater than 0', value: resources.cpus });
    } else if (resources.cpus > 128) { // Reasonable upper limit
      errors.push({ field: 'cpus', message: 'CPU limit cannot exceed 128', value: resources.cpus });
    }
  }

  // Validate disk space limit (in MB)
  if (resources.diskSpace !== undefined) {
    if (typeof resources.diskSpace !== 'number' || !Number.isInteger(resources.diskSpace)) {
      errors.push({ field: 'diskSpace', message: 'Disk space limit must be an integer (MB)', value: resources.diskSpace });
    } else if (resources.diskSpace <= 0) {
      errors.push({ field: 'diskSpace', message: 'Disk space limit must be greater than 0', value: resources.diskSpace });
    }
  }

  // Validate PIDs limit
  if (resources.pidsLimit !== undefined) {
    if (typeof resources.pidsLimit !== 'number' || !Number.isInteger(resources.pidsLimit)) {
      errors.push({ field: 'pidsLimit', message: 'PIDs limit must be an integer', value: resources.pidsLimit });
    } else if (resources.pidsLimit <= 0) {
      errors.push({ field: 'pidsLimit', message: 'PIDs limit must be greater than 0', value: resources.pidsLimit });
    }
  }

  // Validate ulimits
  if (resources.ulimits !== undefined) {
    if (!Array.isArray(resources.ulimits)) {
      errors.push({ field: 'ulimits', message: 'Ulimits must be an array', value: resources.ulimits });
    } else {
      resources.ulimits.forEach((ulimit, index) => {
        if (!ulimit.name || typeof ulimit.name !== 'string') {
          errors.push({ 
            field: `ulimits[${index}].name`, 
            message: 'Ulimit name is required and must be a string', 
            value: ulimit.name 
          });
        }

        if (typeof ulimit.soft !== 'number' || !Number.isInteger(ulimit.soft) || ulimit.soft < 0) {
          errors.push({ 
            field: `ulimits[${index}].soft`, 
            message: 'Ulimit soft value must be a non-negative integer', 
            value: ulimit.soft 
          });
        }

        if (typeof ulimit.hard !== 'number' || !Number.isInteger(ulimit.hard) || ulimit.hard < 0) {
          errors.push({ 
            field: `ulimits[${index}].hard`, 
            message: 'Ulimit hard value must be a non-negative integer', 
            value: ulimit.hard 
          });
        }

        if (typeof ulimit.soft === 'number' && typeof ulimit.hard === 'number' && ulimit.soft > ulimit.hard) {
          errors.push({ 
            field: `ulimits[${index}]`, 
            message: 'Ulimit soft value cannot be greater than hard value', 
            value: { soft: ulimit.soft, hard: ulimit.hard } 
          });
        }
      });
    }
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? resources : undefined,
    errors
  };
}

/**
 * Validates health check configuration
 */
export function validateHealthCheck(healthCheck: HealthCheck): ValidationResult<HealthCheck> {
  const errors: ValidationError[] = [];

  // Validate test command
  if (!healthCheck.test || !Array.isArray(healthCheck.test) || healthCheck.test.length === 0) {
    errors.push({ field: 'test', message: 'Health check test is required and must be a non-empty array of strings' });
  } else {
    healthCheck.test.forEach((cmd, index) => {
      if (typeof cmd !== 'string' || cmd.trim().length === 0) {
        errors.push({ 
          field: `test[${index}]`, 
          message: 'Health check test commands must be non-empty strings', 
          value: cmd 
        });
      }
    });
  }

  // Validate interval (in seconds)
  if (healthCheck.interval !== undefined) {
    if (typeof healthCheck.interval !== 'number' || !Number.isInteger(healthCheck.interval)) {
      errors.push({ field: 'interval', message: 'Health check interval must be an integer (seconds)', value: healthCheck.interval });
    } else if (healthCheck.interval <= 0) {
      errors.push({ field: 'interval', message: 'Health check interval must be greater than 0', value: healthCheck.interval });
    } else if (healthCheck.interval > 3600) { // 1 hour max
      errors.push({ field: 'interval', message: 'Health check interval cannot exceed 3600 seconds (1 hour)', value: healthCheck.interval });
    }
  }

  // Validate timeout (in seconds)
  if (healthCheck.timeout !== undefined) {
    if (typeof healthCheck.timeout !== 'number' || !Number.isInteger(healthCheck.timeout)) {
      errors.push({ field: 'timeout', message: 'Health check timeout must be an integer (seconds)', value: healthCheck.timeout });
    } else if (healthCheck.timeout <= 0) {
      errors.push({ field: 'timeout', message: 'Health check timeout must be greater than 0', value: healthCheck.timeout });
    } else if (healthCheck.timeout > 300) { // 5 minutes max
      errors.push({ field: 'timeout', message: 'Health check timeout cannot exceed 300 seconds (5 minutes)', value: healthCheck.timeout });
    }
  }

  // Validate retries
  if (healthCheck.retries !== undefined) {
    if (typeof healthCheck.retries !== 'number' || !Number.isInteger(healthCheck.retries)) {
      errors.push({ field: 'retries', message: 'Health check retries must be an integer', value: healthCheck.retries });
    } else if (healthCheck.retries < 0) {
      errors.push({ field: 'retries', message: 'Health check retries cannot be negative', value: healthCheck.retries });
    } else if (healthCheck.retries > 10) {
      errors.push({ field: 'retries', message: 'Health check retries cannot exceed 10', value: healthCheck.retries });
    }
  }

  // Validate start period (in seconds)
  if (healthCheck.startPeriod !== undefined) {
    if (typeof healthCheck.startPeriod !== 'number' || !Number.isInteger(healthCheck.startPeriod)) {
      errors.push({ field: 'startPeriod', message: 'Health check start period must be an integer (seconds)', value: healthCheck.startPeriod });
    } else if (healthCheck.startPeriod < 0) {
      errors.push({ field: 'startPeriod', message: 'Health check start period cannot be negative', value: healthCheck.startPeriod });
    } else if (healthCheck.startPeriod > 3600) { // 1 hour max
      errors.push({ field: 'startPeriod', message: 'Health check start period cannot exceed 3600 seconds (1 hour)', value: healthCheck.startPeriod });
    }
  }

  // Cross-validation: timeout should be less than interval
  if (healthCheck.timeout !== undefined && healthCheck.interval !== undefined && healthCheck.timeout >= healthCheck.interval) {
    errors.push({ 
      field: 'timeout', 
      message: 'Health check timeout must be less than interval', 
      value: { timeout: healthCheck.timeout, interval: healthCheck.interval } 
    });
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? healthCheck : undefined,
    errors
  };
}

/**
 * Validates security options configuration
 */
export function validateSecurityOptions(security: SecurityOptions): ValidationResult<SecurityOptions> {
  const errors: ValidationError[] = [];

  // Validate privileged flag
  if (security.privileged !== undefined && typeof security.privileged !== 'boolean') {
    errors.push({ field: 'privileged', message: 'Privileged must be a boolean', value: security.privileged });
  }

  // Validate readOnly flag
  if (security.readOnly !== undefined && typeof security.readOnly !== 'boolean') {
    errors.push({ field: 'readOnly', message: 'ReadOnly must be a boolean', value: security.readOnly });
  }

  // Validate user
  if (security.user !== undefined && (typeof security.user !== 'string' || security.user.trim().length === 0)) {
    errors.push({ field: 'user', message: 'User must be a non-empty string if provided', value: security.user });
  }

  // Validate capabilities
  if (security.capabilities !== undefined) {
    if (typeof security.capabilities !== 'object' || security.capabilities === null) {
      errors.push({ field: 'capabilities', message: 'Capabilities must be an object', value: security.capabilities });
    } else {
      // Validate add capabilities
      if (security.capabilities.add !== undefined) {
        if (!Array.isArray(security.capabilities.add)) {
          errors.push({ field: 'capabilities.add', message: 'Capabilities add must be an array', value: security.capabilities.add });
        } else {
          security.capabilities.add.forEach((cap, index) => {
            if (typeof cap !== 'string' || cap.trim().length === 0) {
              errors.push({ 
                field: `capabilities.add[${index}]`, 
                message: 'Capability names must be non-empty strings', 
                value: cap 
              });
            }
          });
        }
      }

      // Validate drop capabilities
      if (security.capabilities.drop !== undefined) {
        if (!Array.isArray(security.capabilities.drop)) {
          errors.push({ field: 'capabilities.drop', message: 'Capabilities drop must be an array', value: security.capabilities.drop });
        } else {
          security.capabilities.drop.forEach((cap, index) => {
            if (typeof cap !== 'string' || cap.trim().length === 0) {
              errors.push({ 
                field: `capabilities.drop[${index}]`, 
                message: 'Capability names must be non-empty strings', 
                value: cap 
              });
            }
          });
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? security : undefined,
    errors
  };
}

/**
 * Validates that host paths exist and are accessible (for volume validation)
 */
export function validateHostPathExists(hostPath: string): ValidationResult<string> {
  const errors: ValidationError[] = [];

  try {
    const stats = fs.statSync(hostPath);
    if (!stats.isDirectory() && !stats.isFile()) {
      errors.push({ 
        field: 'hostPath', 
        message: 'Host path must be a file or directory', 
        value: hostPath 
      });
    }
  } catch (error) {
    errors.push({ 
      field: 'hostPath', 
      message: 'Host path does not exist or is not accessible', 
      value: hostPath 
    });
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? hostPath : undefined,
    errors
  };
}

/**
 * Validates that a port is not already in use on the host
 */
export function validatePortAvailability(port: number): ValidationResult<number> {
  const errors: ValidationError[] = [];

  // This is a basic validation - in a real implementation, you would check
  // if the port is actually available on the system
  if (port < 1024 && process.getuid && process.getuid() !== 0) {
    errors.push({ 
      field: 'hostPort', 
      message: 'Ports below 1024 require root privileges', 
      value: port 
    });
  }

  // Common reserved ports that should be avoided
  const reservedPorts = [22, 25, 53, 80, 110, 143, 443, 993, 995];
  if (reservedPorts.includes(port)) {
    errors.push({ 
      field: 'hostPort', 
      message: `Port ${port} is commonly reserved for system services`, 
      value: port 
    });
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? port : undefined,
    errors
  };
}

/**
 * Validates container name uniqueness (would typically check against existing containers)
 */
export function validateContainerNameUniqueness(name: string, existingNames: string[] = []): ValidationResult<string> {
  const errors: ValidationError[] = [];

  if (existingNames.includes(name)) {
    errors.push({ 
      field: 'name', 
      message: 'Container name must be unique', 
      value: name 
    });
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? name : undefined,
    errors
  };
}